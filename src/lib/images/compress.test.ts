import { describe, expect, it } from "vitest";
import { computeTargetDimensions, MAX_EDGE_PX } from "./compress";

describe("computeTargetDimensions", () => {
  it("ne redimensionne pas une image déjà sous la limite", () => {
    expect(computeTargetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("réduit le plus grand côté à la limite en conservant le ratio", () => {
    const result = computeTargetDimensions(4000, 3000);
    expect(result.width).toBe(MAX_EDGE_PX);
    expect(result.height).toBe(1200); // 3000 * (1600/4000)
  });

  it("gère les images en portrait de la même façon", () => {
    const result = computeTargetDimensions(3000, 4000);
    expect(result.height).toBe(MAX_EDGE_PX);
    expect(result.width).toBe(1200);
  });

  it("n'agrandit jamais une image plus petite que la limite personnalisée", () => {
    expect(computeTargetDimensions(200, 100, 1600)).toEqual({ width: 200, height: 100 });
  });

  it("rejette des dimensions invalides", () => {
    expect(() => computeTargetDimensions(0, 100)).toThrow(RangeError);
    expect(() => computeTargetDimensions(100, -1)).toThrow(RangeError);
  });
});
