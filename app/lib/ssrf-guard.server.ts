import dns from "node:dns/promises";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * Blocks requests to loopback/private/link-local/metadata addresses so a
 * merchant-supplied URL can't be used to reach internal infrastructure.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (normalized.startsWith("::ffff:")) {
      const v4 = normalized.split(":").pop();
      if (v4 && net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
    }
    return false;
  }
  return true; // not a recognizable IP -> treat as unsafe
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export class UnsafeUrlError extends Error {}

/**
 * Parses and validates a user-supplied URL, resolving its hostname and
 * rejecting anything that points at a private/internal address. Returns the
 * validated URL with the resolved IP so callers can pin the connection to
 * that address (preventing DNS-rebinding between check and fetch).
 */
export async function assertPublicHttpUrl(
  rawUrl: string,
): Promise<{ url: URL; resolvedIp: string }> {
  let normalized = rawUrl.trim();
  // Only add a scheme when none is present at all — never blindly prepend
  // https:// onto a string that already declares a different scheme
  // (e.g. "ftp://…" or "javascript:…"), or the URL parser will treat the
  // declared scheme as part of the host/path and this check gets skipped.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeUrlError("Only http/https URLs are supported.");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new UnsafeUrlError("That URL is not reachable.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeUrlError("That URL is not reachable.");
    }
    return { url, resolvedIp: hostname };
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("Couldn't resolve that domain.");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("Couldn't resolve that domain.");
  }

  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new UnsafeUrlError("That URL is not reachable.");
    }
  }

  return { url, resolvedIp: addresses[0].address };
}

const MAX_REDIRECTS = 3;

/**
 * Pins the TCP connection to the IP we already validated, so a hostname
 * that resolves to a public IP during the check can't rebind to a private
 * one by the time the connection is actually opened.
 */
function pinnedDispatcher(resolvedIp: string) {
  return new Agent({
    connect: {
      lookup: (_hostname, _options, callback) => {
        callback(null, resolvedIp, net.isIPv6(resolvedIp) ? 6 : 4);
      },
    },
  });
}

/**
 * fetch() wrapper that re-validates every redirect hop against the SSRF
 * guard (manual redirect following), pins each connection to its validated
 * IP, and enforces a response size cap.
 */
export async function safeFetch(
  rawUrl: string,
  opts: { accept?: string; timeoutMs?: number; maxBytes?: number } = {},
): Promise<{ response: Response; finalUrl: string }> {
  const { accept, timeoutMs = 8000, maxBytes = 5 * 1024 * 1024 } = opts;

  let currentUrl = rawUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const { url, resolvedIp } = await assertPublicHttpUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = (await undiciFetch(url, {
        redirect: "manual",
        signal: controller.signal,
        dispatcher: pinnedDispatcher(resolvedIp),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LogoFinderBot/1.0)",
          ...(accept ? { Accept: accept } : {}),
        },
      })) as unknown as Response;
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new UnsafeUrlError("Redirect without a location.");
      }
      currentUrl = new URL(location, url).toString();
      continue;
    }

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new UnsafeUrlError("That response is too large.");
    }

    return { response, finalUrl: url.toString() };
  }

  throw new UnsafeUrlError("Too many redirects.");
}

export async function readCappedArrayBuffer(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  if (!response.body) {
    const buf = await response.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new UnsafeUrlError("That response is too large.");
    }
    return buf;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new UnsafeUrlError("That response is too large.");
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out.buffer;
}
