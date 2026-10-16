import type { Connection, Port } from "@/lib/types";
import type { Point } from "./camera";

/** A reference to one endpoint: a component plus one of its ports. */
export interface PortRef {
  componentId: string;
  port: Port;
}

/** A component port resolved to an absolute logical point on the canvas. */
export interface PortAnchor extends PortRef {
  point: Point;
}

/** How close (logical units) a release must be to a port to snap onto it. */
export const CONNECT_SNAP_DISTANCE = 16;

/**
 * The nearest port anchor to `point` within `maxDist`, ignoring ports on
 * `excludeComponentId` (so a connection can't start and end on the same
 * component). Returns `null` when nothing is close enough.
 */
export function findNearestPort(
  anchors: PortAnchor[],
  point: Point,
  maxDist: number = CONNECT_SNAP_DISTANCE,
  excludeComponentId?: string,
): PortAnchor | null {
  let best: PortAnchor | null = null;
  let bestDistance = maxDist;
  for (const anchor of anchors) {
    if (excludeComponentId && anchor.componentId === excludeComponentId) {
      continue;
    }
    const distance = Math.hypot(
      anchor.point.x - point.x,
      anchor.point.y - point.y,
    );
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = anchor;
    }
  }
  return best;
}

function samePort(a: PortRef, b: PortRef): boolean {
  return (
    a.componentId === b.componentId &&
    a.port.side === b.port.side &&
    a.port.index === b.port.index
  );
}

/** Whether a connection between `a` and `b` already exists (either direction). */
export function connectionExists(
  connections: Connection[],
  a: PortRef,
  b: PortRef,
): boolean {
  return connections.some((c) => {
    const from: PortRef = {
      componentId: c.from_component_id,
      port: { side: c.from_port_side, index: c.from_port_index },
    };
    const to: PortRef = {
      componentId: c.to_component_id,
      port: { side: c.to_port_side, index: c.to_port_index },
    };
    return (
      (samePort(from, a) && samePort(to, b)) ||
      (samePort(from, b) && samePort(to, a))
    );
  });
}
