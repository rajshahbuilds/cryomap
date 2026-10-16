"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cameraViewBox,
  centerOnCamera,
  defaultCamera,
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  panCamera,
  screenToLogical,
  wheelToCamera,
  ZOOM_STEP,
  zoomCameraAt,
  type Camera,
  type Point,
  type Size,
} from "@/lib/diagram/camera";

interface UseCanvasOptions {
  /** Pointer moved over the canvas, in logical coords (e.g. snap preview). */
  onLogicalPointerMove?: (point: Point) => void;
  /** Pointer released over the canvas, in logical coords (e.g. drop). */
  onLogicalPointerUp?: (point: Point) => void;
}

const FALLBACK_VIEWPORT: Size = {
  width: LOGICAL_WIDTH,
  height: LOGICAL_HEIGHT,
};

/**
 * Drives the diagram canvas: tracks the viewport size, owns the camera, and
 * exposes pan (Space+drag or middle-button) and zoom (wheel) interactions. The
 * coordinate math itself lives in `lib/diagram/camera`.
 */
export function useCanvas({
  onLogicalPointerMove,
  onLogicalPointerUp,
}: UseCanvasOptions = {}) {
  const elementRef = useRef<SVGSVGElement | null>(null);
  const teardown = useRef<(() => void) | null>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [isPanMode, setIsPanMode] = useState(false);

  const initialized = useRef(false);
  const spaceDown = useRef(false);
  const panning = useRef(false);
  const lastPointer = useRef<Point | null>(null);

  // Keep current camera + callbacks in refs so the pointer handlers stay stable.
  const cameraRef = useRef(camera);
  const viewportRef = useRef(viewport);
  const moveCb = useRef(onLogicalPointerMove);
  const upCb = useRef(onLogicalPointerUp);
  useEffect(() => {
    cameraRef.current = camera;
    viewportRef.current = viewport;
    moveCb.current = onLogicalPointerMove;
    upCb.current = onLogicalPointerUp;
  });

  const toLogical = useCallback((clientX: number, clientY: number): Point => {
    const rect = elementRef.current!.getBoundingClientRect();
    return screenToLogical(cameraRef.current, {
      x: clientX - rect.left,
      y: clientY - rect.top,
    });
  }, []);

  /**
   * Callback ref that wires the canvas SVG up to its DOM-level interactions —
   * a ResizeObserver (measure + fit on first sizing) and a non-passive wheel
   * listener (so `preventDefault` works). Using a callback ref rather than a
   * mount effect is essential: the hook is owned by the editor and can mount
   * before the `<svg>` exists (while the diagram loads) and the `<svg>` can
   * remount on reload — so the listeners must (re)attach whenever the node
   * actually appears, and tear down when it leaves.
   */
  const ref = useCallback((node: SVGSVGElement | null) => {
    teardown.current?.();
    teardown.current = null;
    elementRef.current = node;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ width, height });
      if (!initialized.current && width > 0 && height > 0) {
        setCamera(defaultCamera());
        initialized.current = true;
      }
    });
    observer.observe(node);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = node.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setCamera((c) => wheelToCamera(c, e, anchor));
    };
    node.addEventListener("wheel", onWheel, { passive: false });

    teardown.current = () => {
      observer.disconnect();
      node.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Track the space bar for pan mode.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        spaceDown.current = true;
        setIsPanMode(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false;
        setIsPanMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    // Pan with Space held, or the middle mouse button.
    if (!spaceDown.current && e.button !== 1) return;
    e.preventDefault();
    panning.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    elementRef.current?.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (panning.current && lastPointer.current) {
        const dx = e.clientX - lastPointer.current.x;
        const dy = e.clientY - lastPointer.current.y;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        setCamera((c) => panCamera(c, dx, dy));
        return;
      }
      moveCb.current?.(toLogical(e.clientX, e.clientY));
    },
    [toLogical],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (panning.current) {
        panning.current = false;
        lastPointer.current = null;
        elementRef.current?.releasePointerCapture?.(e.pointerId);
        return;
      }
      upCb.current?.(toLogical(e.clientX, e.clientY));
    },
    [toLogical],
  );

  const onPointerLeave = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!panning.current) return;
    panning.current = false;
    lastPointer.current = null;
    elementRef.current?.releasePointerCapture?.(e.pointerId);
  }, []);

  // Button-driven zoom: zoom about the viewport center so the controls behave
  // predictably regardless of pointer position.
  const zoomBy = useCallback((factor: number) => {
    const vp = viewportRef.current;
    if (vp.width <= 0 || vp.height <= 0) return;
    const anchor = { x: vp.width / 2, y: vp.height / 2 };
    setCamera((c) => zoomCameraAt(c, factor, anchor));
  }, []);

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);

  /** Return to the initial top-left view at the default zoom. */
  const resetView = useCallback(() => {
    const vp = viewportRef.current;
    if (vp.width > 0 && vp.height > 0) setCamera(defaultCamera());
  }, []);

  /** Pan (keeping zoom) so a logical point sits at the viewport center. */
  const centerOn = useCallback((point: Point) => {
    const vp = viewportRef.current;
    if (vp.width <= 0 || vp.height <= 0) return;
    setCamera((c) => centerOnCamera(point, vp, c.scale));
  }, []);

  const effectiveViewport = viewport.width > 0 ? viewport : FALLBACK_VIEWPORT;
  const viewBox = cameraViewBox(camera, effectiveViewport);
  const viewBoxString = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;

  /** The live canvas SVG node, for readers like image/PDF export. */
  const getElement = useCallback(() => elementRef.current, []);

  /** Logical coords at the center of the current viewport (for placing new items). */
  const centerLogical = useCallback((): Point => {
    const node = elementRef.current;
    if (!node) return { x: 0, y: 0 };
    const rect = node.getBoundingClientRect();
    return toLogical(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [toLogical]);

  return {
    ref,
    getElement,
    camera,
    viewport,
    viewBoxString,
    isPanMode,
    toLogical,
    centerLogical,
    centerOn,
    zoomIn,
    zoomOut,
    resetView,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
    },
  };
}

/** The object returned by {@link useCanvas}, consumed by the {@link Canvas}. */
export type CanvasController = ReturnType<typeof useCanvas>;
