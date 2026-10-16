import { describe, it, expect } from "vitest";
import { pdfOrientation } from "@/lib/diagram/exportImage";

describe("pdfOrientation", () => {
  it("is landscape for wide (and square) diagrams", () => {
    expect(pdfOrientation({ width: 1600, height: 900 })).toBe("landscape");
    expect(pdfOrientation({ width: 1000, height: 1000 })).toBe("landscape");
  });

  it("is portrait for tall diagrams", () => {
    expect(pdfOrientation({ width: 900, height: 1600 })).toBe("portrait");
  });
});
