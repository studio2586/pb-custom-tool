import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { findLogo, LogoNotFoundError } from "../lib/logo-scraper.server";
import { UnsafeUrlError } from "../lib/ssrf-guard.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawUrl = (body.url || "").trim();
  if (!rawUrl) {
    return Response.json({ error: "Enter a website URL." }, { status: 400 });
  }

  try {
    const logo = await findLogo(rawUrl);
    return Response.json({
      logoUrl: logo.dataUrl,
      sourceUrl: logo.sourceUrl,
      candidateType: logo.candidateType,
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError || error instanceof LogoNotFoundError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("logo scrape failed", error);
    return Response.json(
      { error: "Something went wrong finding that logo. Try another URL." },
      { status: 500 },
    );
  }
};
