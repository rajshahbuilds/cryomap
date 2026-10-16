import { describe, it, expect } from "vitest";
import {
  cameraViewBox,
  centerOnCamera,
  clampScale,
  defaultCamera,
  DEFAULT_SCALE,
  fitCamera,
  INITIAL_MARGIN,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  logicalToScreen,
  MAX_SCALE,
  MIN_SCALE,
  panCamera,
  screenToLogical,
  snap,
  snapPoint,
  wheelToCamera,
  zoomCameraAt,
  ZOOM_WHEEL_SENSITIVITY,
  type Camera,
} from "@/lib/diagram/camera";

const camera: Camera = { x: 100, y: 50, scale: 2 };

describe("centerOnCamera", () => {
  it("puts the given logical point at the viewport center", () => {
    const viewport = { width: 800, height: 600 };
    const point = { x: 1000, y: 400 };
    const cam = centerOnCamera(point, viewport, 2);
    // The point must map to the middle of the viewport.
    expect(logicalToScreen(cam, point)).toEqual({ x: 400, y: 300 });
    expect(cam.scale).toBe(2);
  });
});

describe("screen ↔ logical conversion", () => {
  it("maps the viewport top-left to the camera origin", () => {
    expect(screenToLogical(camera, { x: 0, y: 0 })).toEqual({ x: 100, y: 50 });
  });

  it("scales screen pixels into logical units", () => {
    expect(screenToLogical(camera, { x: 40, y: 10 })).toEqual({
      x: 120,
      y: 55,
    });
  });

  it("round-trips exactly", () => {
    const logical = { x: 1234.5, y: 678.25 };
    const screen = logicalToScreen(camera, logical);
    expect(screenToLogical(camera, screen)).toEqual(logical);
  });
});

describe("cameraViewBox", () => {
  it("derives width/height from the viewport and scale", () => {
    expect(cameraViewBox(camera, { width: 800, height: 600 })).toEqual({
      x: 100,
      y: 50,
      width: 400,
      height: 300,
    });
  });

  it("matches the viewport aspect ratio (no letterboxing)", () => {
    const vb = cameraViewBox(camera, { width: 800, height: 600 });
    expect(vb.width / vb.height).toBeCloseTo(800 / 600);
  });
});

describe("panCamera", () => {
  it("shifts the origin opposite the drag, in logical units", () => {
    expect(panCamera(camera, 40, -20)).toEqual({ x: 80, y: 60, scale: 2 });
  });
});

describe("zoomCameraAt", () => {
  it("keeps the logical point under the anchor fixed", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToLogical(camera, anchor);
    const zoomed = zoomCameraAt(camera, 1.5, anchor);
    const after = screenToLogical(zoomed, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomed.scale).toBeCloseTo(3);
  });

  it("clamps scale and still holds the anchor", () => {
    const anchor = { x: 120, y: 80 };
    const before = screenToLogical(camera, anchor);
    const zoomed = zoomCameraAt(camera, 1000, anchor);
    expect(zoomed.scale).toBe(MAX_SCALE);
    expect(screenToLogical(zoomed, anchor).x).toBeCloseTo(before.x);
  });
});

describe("clampScale", () => {
  it("bounds the scale to [MIN_SCALE, MAX_SCALE]", () => {
    expect(clampScale(0.0001)).toBe(MIN_SCALE);
    expect(clampScale(9999)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe("snapping", () => {
  it("rounds to the nearest grid line", () => {
    expect(snap(9)).toBe(0);
    expect(snap(11)).toBe(20);
    expect(snap(30)).toBe(40);
    expect(snap(57, 25)).toBe(50);
  });

  it("snaps both axes of a point", () => {
    expect(snapPoint({ x: 11, y: 9 })).toEqual({ x: 20, y: 0 });
  });
});

describe("defaultCamera", () => {
  it("anchors the content's top-left near the viewport top-left", () => {
    const cam = defaultCamera();
    expect(cam.scale).toBe(DEFAULT_SCALE);
    // The logical origin (content top-left) sits just inside the viewport's
    // top-left corner, by INITIAL_MARGIN logical units on each axis.
    const topLeft = screenToLogical(cam, { x: 0, y: 0 });
    expect(topLeft.x).toBeCloseTo(-INITIAL_MARGIN);
    expect(topLeft.y).toBeCloseTo(-INITIAL_MARGIN);
    const origin = logicalToScreen(cam, { x: 0, y: 0 });
    expect(origin.x).toBeCloseTo(INITIAL_MARGIN * cam.scale);
    expect(origin.y).toBeCloseTo(INITIAL_MARGIN * cam.scale);
  });
});

describe("fitCamera", () => {
  it("centers the logical space within the viewport", () => {
    const viewport = { width: 800, height: 600 };
    const cam = fitCamera(viewport);
    const center = screenToLogical(cam, {
      x: viewport.width / 2,
      y: viewport.height / 2,
    });
    expect(center.x).toBeCloseTo(LOGICAL_WIDTH / 2);
    expect(center.y).toBeCloseTo(LOGICAL_HEIGHT / 2);
  });

  it("never exceeds the zoom bounds", () => {
    const cam = fitCamera({ width: 10, height: 10 });
    expect(cam.scale).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(cam.scale).toBeLessThanOrEqual(MAX_SCALE);
  });
});

describe("wheelToCamera", () => {
  const anchor = { x: 40, y: 10 };

  it("pans on a plain scroll (no modifier), opposite the scroll delta", () => {
    const next = wheelToCamera(
      camera,
      { deltaX: 20, deltaY: -8, ctrlKey: false, metaKey: false },
      anchor,
    );
    // pan by the negated screen delta: x - (-20)/2, y - (8)/2
    expect(next).toEqual(panCamera(camera, -20, 8));
    expect(next.scale).toBe(camera.scale); // pan never changes zoom
  });

  it("zooms about the anchor on a pinch (ctrlKey)", () => {
    const next = wheelToCamera(
      camera,
      { deltaX: 0, deltaY: -50, ctrlKey: true, metaKey: false },
      anchor,
    );
    expect(next).toEqual(
      zoomCameraAt(camera, Math.exp(50 * ZOOM_WHEEL_SENSITIVITY), anchor),
    );
    expect(next.scale).toBeGreaterThan(camera.scale); // negative deltaY zooms in
  });

  it("also zooms on ⌘/Ctrl+scroll (metaKey)", () => {
    const next = wheelToCamera(
      camera,
      { deltaX: 0, deltaY: 50, ctrlKey: false, metaKey: true },
      anchor,
    );
    expect(next.scale).toBeLessThan(camera.scale); // positive deltaY zooms out
  });
});
