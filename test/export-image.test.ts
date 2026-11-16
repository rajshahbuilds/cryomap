import { describe, it, expect } from "vitest";
import { pdfOrientation, serializeDiagram } from "@/lib/diagram/exportImage";

describe("pdfOrientation", () => {
  it("is landscape for wide (and square) diagrams", () => {
    expect(pdfOrientation({ width: 1600, height: 900 })).toBe("landscape");
    expect(pdfOrientation({ width: 1000, height: 1000 })).toBe("landscape");
  });

  it("is portrait for tall diagrams", () => {
    expect(pdfOrientation({ width: 900, height: 1600 })).toBe("portrait");
  });
});

describe("diagram export", () => {
  it("includes the port header and excludes editing guides", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.dataset.topInset = "80";
    const port = document.createElementNS(svg.namespaceURI, "polygon");
    port.setAttribute("points", "0,-72 10,-48 0,-24");
    svg.append(port);
    const guide = document.createElementNS(svg.namespaceURI, "line");
    guide.setAttribute("data-editor-only", "true");
    svg.append(guide);
    document.body.append(svg);
    const output = serializeDiagram(svg, { width: 1200, height: 800 });
    expect(output).toContain('viewBox="0 -80 1200 880"');
    expect(output).toContain('height="880"');
    expect(output).toContain("polygon");
    expect(output).not.toContain("data-editor-only");
    expect(svg.querySelector("[data-editor-only]")).not.toBeNull();
    svg.remove();
  });
});
