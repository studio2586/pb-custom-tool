import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const shop = new URL(request.url).searchParams.get("shop");
  if (!shop) {
    return Response.json({ error: "Missing shop." }, { status: 400 });
  }

  let body: { email?: string; websiteUrl?: string; logoImageUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const websiteUrl = (body.websiteUrl || "").trim();
  const logoImageUrl = (body.logoImageUrl || "").trim();

  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!websiteUrl) {
    return Response.json({ error: "Missing website URL." }, { status: 400 });
  }

  await db.emailCapture.create({
    data: {
      shop,
      email,
      sourceUrl: websiteUrl.slice(0, 2048),
      // Only store a link to the logo, never the embedded image data.
      logoUrl: logoImageUrl.startsWith("data:") ? null : logoImageUrl.slice(0, 2048) || null,
    },
  });

  return Response.json({ ok: true });
};
