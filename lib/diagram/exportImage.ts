/**
 * Client-side raster/PDF export of the diagram canvas. The visible `<svg>` is
 * panned/zoomed to the current camera and styled with Tailwind utility classes
 * (`fill-surface`, `stroke-border`, …) that resolve to CSS custom properties.
 * A standalone SVG rendered through an `<img>` has no access to the page
 * stylesheet, so those classes would render as nothing. We therefore clone the
 * live SVG, copy the *computed* presentation styles from the rendered tree onto
 * the clone (making it self-contained), reframe it to the full content extent,
 * serialize it, and draw it to a canvas. PDF wraps the raster via jsPDF.
 */
import { jsPDF } from "jspdf";
import type { Size } from "./camera";

/** Upscale factor for crisp output on high-DPI screens and print. */
const PIXEL_RATIO = 2;

/**
 * SVG presentation properties copied from the live element's computed style so
 * the serialized clone renders without the page stylesheet. Layout/geometry
 * (width/height/viewBox/transform) is left to the element's own attributes.
 */
const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "opacity",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-anchor",
  "dominant-baseline",
  "letter-spacing",
  "visibility",
] as const;

/** Portrait when the content is taller than it is wide, else landscape. */
export function pdfOrientation(size: Size): "portrait" | "landscape" {
  return size.height > size.width ? "portrait" : "landscape";
}

/** Copy computed presentation styles from each live node onto its clone twin. */
function inlineComputedStyles(live: Element, clone: Element): void {
  const computed = getComputedStyle(live);
  const style = (clone as SVGElement).style;
  for (const prop of STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value) style.setProperty(prop, value);
  }
  const liveChildren = live.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < liveChildren.length; i++) {
    inlineComputedStyles(liveChildren[i], cloneChildren[i]);
  }
}

/** Serialize the diagram into a self-contained, full-extent SVG string. */
function serializeDiagram(svg: SVGSVGElement, size: Size): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  clone.setAttribute("width", String(size.width));
  clone.setAttribute("height", String(size.height));
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");
  clone.removeAttribute("class");
  return new XMLSerializer().serializeToString(clone);
}

/** Rasterize the whole diagram to a white-backed canvas at 2× resolution. */
async function captureCanvas(
  svg: SVGSVGElement,
  size: Size,
): Promise<HTMLCanvasElement> {
  const svgString = serializeDiagram(svg, size);
  const url = URL.createObjectURL(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.width = size.width;
    image.height = size.height;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the diagram."));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(size.width * PIXEL_RATIO);
    canvas.height = Math.round(size.height * PIXEL_RATIO);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not render the diagram.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Trigger a browser download of a blob under `filename`. */
function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Export the full diagram as a PNG file. */
export async function exportPng(
  svg: SVGSVGElement,
  size: Size,
  filename: string,
): Promise<void> {
  const canvas = await captureCanvas(svg, size);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Could not render the diagram image.");
  downloadBlob(filename, blob);
}

/** Export the full diagram as a single-page PDF sized to the diagram. */
export async function exportPdf(
  svg: SVGSVGElement,
  size: Size,
  filename: string,
): Promise<void> {
  const canvas = await captureCanvas(svg, size);
  const dataUrl = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: pdfOrientation(size),
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(filename);
}
