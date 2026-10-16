/**
 * Pure 2D camera + coordinate math for the diagram canvas.
 *
 * The logical drawing space is a fixed ~4000×3000 grid. The on-screen view is
 * described by a {@link Camera}: the logical coordinate at the viewport's
 * top-left corner (`x`/`y`) plus `scale` = CSS pixels per logical unit. The SVG
 * `viewBox` is derived from the camera and the live viewport size, so its aspect
 * ratio always matches the element — there is no letterboxing, and screen↔logical
 * conversion stays exact.
 *
 * Everything here is framework-free and unit-tested; React lives in useCanvas.
 */

export const LOGICAL_WIDTH = 4000;
export const LOGICAL_HEIGHT = 3000;
export const GRID_SIZE = 20;

/** Zoom limits, in CSS pixels per logical unit. */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;

/** Multiplier applied by a single zoom-in step (zoom-out divides by it). */
export const ZOOM_STEP = 1.25;

/**
 * Pinch / ⌘-scroll zoom responsiveness: scale factor per unit of wheel `deltaY`
 * (applied as `exp(-deltaY * this)`). Higher = faster, more sensitive zoom.
 */
export const ZOOM_WHEEL_SENSITIVITY = 0.004;

/** Initial zoom: 1 CSS pixel per logical unit, so the 20px grid is legible. */
export const DEFAULT_SCALE = 1;

/**
 * Gap, in logical units, left between the content's top-left (logical origin)
 * and the viewport's top-left corner on first load, so the diagram doesn't
 * butt right up against the edge.
 */
export const INITIAL_MARGIN = 40;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** `x`/`y`: logical coord at the viewport's top-left. `scale`: px per unit. */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** SVG viewBox for the current camera over a viewport of the given size. */
export function cameraViewBox(camera: Camera, viewport: Size): ViewBox {
  return {
    x: camera.x,
    y: camera.y,
    width: viewport.width / camera.scale,
    height: viewport.height / camera.scale,
  };
}

/** Convert a point in element-local screen pixels to logical coordinates. */
export function screenToLogical(camera: Camera, screen: Point): Point {
  return {
    x: camera.x + screen.x / camera.scale,
    y: camera.y + screen.y / camera.scale,
  };
}

/** Convert a logical point to element-local screen pixels. */
export function logicalToScreen(camera: Camera, logical: Point): Point {
  return {
    x: (logical.x - camera.x) * camera.scale,
    y: (logical.y - camera.y) * camera.scale,
  };
}

/** Pan by a screen-pixel delta (e.g. a pointer drag). */
export function panCamera(
  camera: Camera,
  dxScreen: number,
  dyScreen: number,
): Camera {
  return {
    ...camera,
    x: camera.x - dxScreen / camera.scale,
    y: camera.y - dyScreen / camera.scale,
  };
}

/**
 * Zoom by `factor` (>1 zooms in) while keeping the logical point under
 * `anchorScreen` fixed on screen. Scale is clamped to [MIN_SCALE, MAX_SCALE].
 */
export function zoomCameraAt(
  camera: Camera,
  factor: number,
  anchorScreen: Point,
): Camera {
  const newScale = clampScale(camera.scale * factor);
  const logical = screenToLogical(camera, anchorScreen);
  return {
    scale: newScale,
    x: logical.x - anchorScreen.x / newScale,
    y: logical.y - anchorScreen.y / newScale,
  };
}

/** The bits of a wheel/trackpad event the camera cares about. */
export interface WheelInput {
  deltaX: number;
  deltaY: number;
  /** macOS sends ctrlKey for a trackpad pinch; also true for Ctrl+scroll. */
  ctrlKey: boolean;
  metaKey: boolean;
}

/**
 * Map a wheel/trackpad gesture to a new camera, following the canvas-app
 * convention (Figma/Excalidraw): a pinch (which the OS reports as `ctrlKey`) or
 * an explicit ⌘/Ctrl+scroll zooms about `anchor`, while any other scroll —
 * two-finger trackpad drag or a mouse wheel — pans.
 */
export function wheelToCamera(
  camera: Camera,
  input: WheelInput,
  anchor: Point,
): Camera {
  if (input.ctrlKey || input.metaKey) {
    return zoomCameraAt(
      camera,
      Math.exp(-input.deltaY * ZOOM_WHEEL_SENSITIVITY),
      anchor,
    );
  }
  // Scrolling "by" a delta is like dragging the content by the negative delta.
  return panCamera(camera, -input.deltaX, -input.deltaY);
}

/** Round a value to the nearest grid line. */
export function snap(value: number, grid: number = GRID_SIZE): number {
  return Math.round(value / grid) * grid;
}

/** Snap a logical point to the nearest grid intersection. */
export function snapPoint(point: Point, grid: number = GRID_SIZE): Point {
  return { x: snap(point.x, grid), y: snap(point.y, grid) };
}

/** A camera that puts `point` (logical) at the viewport center, keeping scale. */
export function centerOnCamera(
  point: Point,
  viewport: Size,
  scale: number,
): Camera {
  return {
    scale,
    x: point.x - viewport.width / (2 * scale),
    y: point.y - viewport.height / (2 * scale),
  };
}

/** A camera centered on the logical space at the given scale. */
function centeredCamera(viewport: Size, scale: number): Camera {
  return centerOnCamera(
    { x: LOGICAL_WIDTH / 2, y: LOGICAL_HEIGHT / 2 },
    viewport,
    scale,
  );
}

/**
 * The initial view: anchored at the content's top-left (the logical origin)
 * with a small {@link INITIAL_MARGIN} gap, at {@link DEFAULT_SCALE} so the grid
 * is immediately legible. A top-left anchor is independent of viewport size.
 */
export function defaultCamera(): Camera {
  const scale = clampScale(DEFAULT_SCALE);
  return { scale, x: -INITIAL_MARGIN, y: -INITIAL_MARGIN };
}

/** A camera that fits the whole logical space centered in the viewport. */
export function fitCamera(viewport: Size): Camera {
  const scale = clampScale(
    Math.min(viewport.width / LOGICAL_WIDTH, viewport.height / LOGICAL_HEIGHT),
  );
  return centeredCamera(viewport, scale);
}
