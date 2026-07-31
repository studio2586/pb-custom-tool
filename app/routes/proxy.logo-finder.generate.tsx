import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { compositeLogoOntoAllMockups, CompositeError } from "../lib/compositor.server";

const MAX_LOGO_DATA_URL_LENGTH = 6 * 1024 * 1024; // ~4.5MB decoded

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.public.appProxy(request);

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: { logoUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const logoUrl = body.logoUrl || "";
  if (!logoUrl.startsWith("data:image/")) {
    return Response.json({ error: "A logo image is required." }, { status: 400 });
  }
  if (logoUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
    return Response.json({ error: "That logo image is too large." }, { status: 413 });
  }

  try {
    const previews = await compositeLogoOntoAllMockups(logoUrl);
    return Response.json({ previews });
  } catch (error) {
    if (error instanceof CompositeError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    console.error("mockup generation failed", error);
    return Response.json(
      { error: "Something went wrong generating your previews." },
      { status: 500 },
    );
  }
};
