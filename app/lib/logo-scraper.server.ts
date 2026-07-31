import * as cheerio from "cheerio";
import { safeFetch, readCappedArrayBuffer, UnsafeUrlError } from "./ssrf-guard.server";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export class LogoNotFoundError extends Error {}

export interface LogoResult {
  dataUrl: string;
  contentType: string;
  sourceUrl: string;
  candidateType: string;
}

interface Candidate {
  url: string;
  type: string;
  priority: number;
}

function resolveUrl(maybeRelative: string, base: string): string | null {
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function collectCandidates($: cheerio.CheerioAPI, pageUrl: string): Candidate[] {
  const candidates: Candidate[] = [];
  const push = (raw: string | undefined, type: string, priority: number) => {
    if (!raw) return;
    const resolved = resolveUrl(raw.trim(), pageUrl);
    if (resolved) candidates.push({ url: resolved, type, priority });
  };

  // <img> tags that look like a logo, favoring ones inside header/nav.
  $("header img, nav img, [class*='logo'] img, [id*='logo'] img, img[class*='logo'], img[id*='logo'], img[alt*='logo' i], img[src*='logo' i]").each(
    (_, el) => {
      const $el = $(el);
      const src = $el.attr("src") || $el.attr("data-src") || $el.attr("data-srcset")?.split(" ")[0];
      const inHeader = $el.closest("header, nav").length > 0;
      const looksLikeLogo = /logo/i.test($el.attr("alt") || "") || /logo/i.test($el.attr("class") || "") || /logo/i.test($el.attr("src") || "");
      let priority = 50;
      if (inHeader) priority -= 10;
      if (looksLikeLogo) priority -= 15;
      push(src, "img", priority);
    },
  );

  // Apple touch icon / large favicons tend to be clean square marks.
  $("link[rel~='apple-touch-icon']").each((_, el) => {
    push($(el).attr("href"), "apple-touch-icon", 30);
  });

  $("link[rel='icon'], link[rel='shortcut icon']").each((_, el) => {
    const sizes = $(el).attr("sizes") || "";
    const sizeMatch = sizes.match(/(\d+)x\d+/);
    const size = sizeMatch ? Number(sizeMatch[1]) : 16;
    // Larger declared icons rank better than the default tiny favicon.
    const priority = size >= 96 ? 25 : 70;
    push($(el).attr("href"), "icon", priority);
  });

  // og:image / twitter:image as a last resort — often a hero/banner, not a logo.
  push($("meta[property='og:image']").attr("content"), "og:image", 90);
  push($("meta[name='twitter:image']").attr("content"), "twitter:image", 95);

  return candidates.sort((a, b) => a.priority - b.priority);
}

async function tryFetchImage(url: string): Promise<LogoResult | null> {
  try {
    const { response, finalUrl } = await safeFetch(url, {
      accept: "image/*",
      timeoutMs: 8000,
      maxBytes: MAX_IMAGE_BYTES,
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    const UNSUPPORTED = ["image/x-icon", "image/vnd.microsoft.icon", "image/bmp"];
    if (!contentType.startsWith("image/") || UNSUPPORTED.includes(contentType)) return null;

    const buffer = await readCappedArrayBuffer(response, MAX_IMAGE_BYTES);
    if (buffer.byteLength < 100) return null; // almost certainly a broken/empty image

    const base64 = Buffer.from(buffer).toString("base64");
    return {
      dataUrl: `data:${contentType};base64,${base64}`,
      contentType,
      sourceUrl: finalUrl,
      candidateType: "",
    };
  } catch {
    return null;
  }
}

export async function findLogo(inputUrl: string): Promise<LogoResult> {
  const { response, finalUrl } = await safeFetch(inputUrl, {
    accept: "text/html",
    timeoutMs: 8000,
    maxBytes: MAX_HTML_BYTES,
  });

  if (!response.ok) {
    throw new UnsafeUrlError(`Site responded with ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("html")) {
    throw new LogoNotFoundError("That URL didn't return a webpage.");
  }

  const htmlBuffer = await readCappedArrayBuffer(response, MAX_HTML_BYTES);
  const html = Buffer.from(htmlBuffer).toString("utf-8");
  const $ = cheerio.load(html);

  const candidates = collectCandidates($, finalUrl);

  // Fallback: default favicon path, tried last.
  const defaultFavicon = resolveUrl("/favicon.ico", finalUrl);
  if (defaultFavicon) {
    candidates.push({ url: defaultFavicon, type: "favicon-fallback", priority: 100 });
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);

    const result = await tryFetchImage(candidate.url);
    if (result) {
      return { ...result, candidateType: candidate.type };
    }
  }

  throw new LogoNotFoundError("Couldn't find a logo on that site.");
}
