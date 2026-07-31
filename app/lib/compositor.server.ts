import sharp from "sharp";
import path from "node:path";
import { MOCKUP_PRODUCTS, type MockupProduct } from "./mockups";

export interface CompositeResult {
  id: string;
  name: string;
  dataUrl: string;
}

export class CompositeError extends Error {}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const match = /^data:[^;]+;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new CompositeError("Invalid logo image data.");
  return Buffer.from(match[1], "base64");
}

async function compositeOne(
  product: MockupProduct,
  logoBuffer: Buffer,
): Promise<CompositeResult> {
  const basePath = path.join(process.cwd(), "public", product.file.replace(/^\//, ""));
  const { logoZone } = product;

  const resizedLogo = await sharp(logoBuffer)
    .resize({
      width: Math.round(logoZone.width),
      height: Math.round(logoZone.height),
      fit: "inside",
      withoutEnlargement: false,
    })
    .toBuffer();

  const logoMeta = await sharp(resizedLogo).metadata();
  const left = Math.round(logoZone.x + (logoZone.width - (logoMeta.width || logoZone.width)) / 2);
  const top = Math.round(logoZone.y + (logoZone.height - (logoMeta.height || logoZone.height)) / 2);

  const output = await sharp(basePath)
    .resize(product.width, product.height)
    .composite([{ input: resizedLogo, left, top }])
    .png({ compressionLevel: 8 })
    .toBuffer();

  return {
    id: product.id,
    name: product.name,
    dataUrl: `data:image/png;base64,${output.toString("base64")}`,
  };
}

export async function compositeLogoOntoAllMockups(
  logoDataUrl: string,
): Promise<CompositeResult[]> {
  const logoBuffer = dataUrlToBuffer(logoDataUrl);

  // Validate the logo decodes before spending time on 5 composites.
  try {
    await sharp(logoBuffer).metadata();
  } catch {
    throw new CompositeError("Couldn't process that logo image.");
  }

  try {
    return await Promise.all(MOCKUP_PRODUCTS.map((p) => compositeOne(p, logoBuffer)));
  } catch {
    throw new CompositeError("Couldn't generate the product previews.");
  }
}
