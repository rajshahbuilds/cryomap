import type { Port, PortSide, Rotation } from "@/lib/types";
import { PORT_SIDES } from "@/lib/types";
import type { Point, Size } from "@/lib/diagram/camera";

/** A port resolved to a position in symbol-local (origin-centered) coords. */
export interface PlacedPort extends Point {
  port: Port;
}

/**
 * Rotate a point about the origin by a component rotation. Matches the SVG
 * `rotate(deg)` transform (y-down), so computed port positions line up with the
 * rendered glyph.
 */
export function rotatePoint(point: Point, rotation: Rotation): Point {
  switch (rotation) {
    case 90:
      return { x: -point.y, y: point.x };
    case 180:
      return { x: -point.x, y: -point.y };
    case 270:
      return { x: point.y, y: -point.x };
    default:
      return { x: point.x, y: point.y };
  }
}

/**
 * Resolve each port to an origin-centered local position. Ports sharing a side
 * are distributed evenly along it (ordered by `index`); a lone port sits at the
 * side's midpoint.
 *
 * `leadLength` pushes each port outward along its side's normal, so the port
 * (and any wire snapped to it) sits on the end of a lead stub sticking out of
 * the box. Built-in glyphs draw their leads inward and pass `0`; custom boxes
 * extend outward (see `componentPortLead`).
 */
export function localPortPositions(
  ports: Port[],
  size: Size,
  leadLength = 0,
): PlacedPort[] {
  const halfW = size.width / 2;
  const halfH = size.height / 2;

  const bySide = Object.fromEntries(
    PORT_SIDES.map((side) => [side, [] as Port[]]),
  ) as Record<PortSide, Port[]>;
  for (const port of ports) bySide[port.side].push(port);
  for (const side of PORT_SIDES) {
    bySide[side].sort((a, b) => a.index - b.index);
  }

  return ports.map((port) => {
    const sidePorts = bySide[port.side];
    const fraction = (sidePorts.indexOf(port) + 1) / (sidePorts.length + 1);
    switch (port.side) {
      case "left":
        return {
          port,
          x: -halfW - leadLength,
          y: -halfH + fraction * size.height,
        };
      case "right":
        return {
          port,
          x: halfW + leadLength,
          y: -halfH + fraction * size.height,
        };
      case "top":
        return {
          port,
          x: -halfW + fraction * size.width,
          y: -halfH - leadLength,
        };
      case "bottom":
        return {
          port,
          x: -halfW + fraction * size.width,
          y: halfH + leadLength,
        };
    }
  });
}

/** The next 90° clockwise rotation (0 → 90 → 180 → 270 → 0). */
export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

/**
 * Local port positions after applying the component's transform: a horizontal
 * mirror (when `mirrored`) is applied first, then the rotation — matching the
 * SVG `rotate(r) scale(-1 1)` order used by `ComponentSymbol`.
 */
export function portPositions(
  ports: Port[],
  size: Size,
  rotation: Rotation,
  mirrored = false,
  leadLength = 0,
): PlacedPort[] {
  return localPortPositions(ports, size, leadLength).map(({ port, x, y }) => ({
    port,
    ...rotatePoint({ x: mirrored ? -x : x, y }, rotation),
  }));
}

/** A side after a horizontal mirror (left↔right; top/bottom unchanged). */
const MIRROR_SIDE: Record<PortSide, PortSide> = {
  left: "right",
  right: "left",
  top: "top",
  bottom: "bottom",
};

/** A side after a clockwise rotation, keyed by rotation then side. */
const ROTATE_SIDE: Record<Rotation, Record<PortSide, PortSide>> = {
  0: { left: "left", right: "right", top: "top", bottom: "bottom" },
  90: { left: "top", top: "right", right: "bottom", bottom: "left" },
  180: { left: "right", right: "left", top: "bottom", bottom: "top" },
  270: { left: "bottom", bottom: "right", right: "top", top: "left" },
};

/**
 * The side a port physically faces after the component's mirror + rotation,
 * matching `portPositions`. Used to route connection wires outward from the
 * port's real direction.
 */
export function effectiveSide(
  side: PortSide,
  rotation: Rotation,
  mirrored = false,
): PortSide {
  return ROTATE_SIDE[rotation][mirrored ? MIRROR_SIDE[side] : side];
}
