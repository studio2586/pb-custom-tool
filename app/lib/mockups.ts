export interface LogoZone {
  /** All values are in the mockup's own pixel space (each mockup is 800x800). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise. */
  rotate?: number;
  /** Opacity applied to the logo layer, 0-1. */
  opacity?: number;
}

export interface MockupProduct {
  id: string;
  name: string;
  /** Path under /public. Swap this file for real product photography. */
  file: string;
  width: number;
  height: number;
  logoZone: LogoZone;
}

// NOTE: these are flat placeholder SVGs, not real product photography.
// Replace the files in public/mockups/ with real photos of your 4-5 products,
// then update each logoZone below to match where the logo should sit.
export const MOCKUP_PRODUCTS: MockupProduct[] = [
  {
    id: "dog-bowl",
    name: "Dog Bowl",
    file: "/mockups/dog-bowl.svg",
    width: 800,
    height: 800,
    logoZone: { x: 240, y: 360, width: 320, height: 90 },
  },
  {
    id: "frisbee-toy",
    name: "Frisbee Toy",
    file: "/mockups/frisbee-toy.svg",
    width: 800,
    height: 800,
    logoZone: { x: 270, y: 330, width: 270, height: 120 },
  },
  {
    id: "travel-bowl",
    name: "Travel Bowl",
    file: "/mockups/travel-bowl.svg",
    width: 800,
    height: 800,
    logoZone: { x: 290, y: 380, width: 220, height: 100 },
  },
  {
    id: "pet-mat",
    name: "Pet Mat",
    file: "/mockups/pet-mat.svg",
    width: 800,
    height: 800,
    logoZone: { x: 265, y: 355, width: 270, height: 90 },
  },
  {
    id: "tote-bag",
    name: "Tote Bag",
    file: "/mockups/tote-bag.svg",
    width: 800,
    height: 800,
    logoZone: { x: 290, y: 400, width: 220, height: 130 },
  },
];

export function getMockupProduct(id: string): MockupProduct | undefined {
  return MOCKUP_PRODUCTS.find((p) => p.id === id);
}
