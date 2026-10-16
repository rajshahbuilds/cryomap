import type { Port, PortSide } from "@/lib/types";
import type { Point } from "@/lib/diagram/camera";
import type { Box } from "@/lib/diagram/placement";

/** A drawable wire between two resolved logical points. */
export interface Wire {
  key: string;
  from: Point;
  to: Point;
  /** Precomputed SVG path (e.g. orthogonal routing); falls back to a straight segment. */
  path?: string;
  /** Polyline vertices of the route (for crossing/hop computation). */
  points?: Point[];
}

/** SVG path for a wire between two points (straight segment). */
export function wirePath(from: Point, to: Point): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

/** Build an `M…L…` path from polyline vertices. */
export function pointsToPath(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/** Unit vector a port's wire leaves in, by side. */
const PORT_FACING: Record<PortSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
};

/** How far a wire extends straight out of a port before it may turn. */
const PORT_STUB = 16;

/** The point a wire reaches after its straight stub out of a port. */
function portStub(p: Point, side?: PortSide): Point {
  const facing = side ? PORT_FACING[side] : { x: 0, y: 0 };
  return { x: p.x + facing.x * PORT_STUB, y: p.y + facing.y * PORT_STUB };
}

/** Drop consecutive duplicate and collinear points from an axis-aligned route. */
export function pruneCollinear(points: Point[]): Point[] {
  const dedup = points.filter(
    (p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y,
  );
  const out: Point[] = [];
  for (let i = 0; i < dedup.length; i++) {
    if (i === 0 || i === dedup.length - 1) {
      out.push(dedup[i]);
      continue;
    }
    const a = out[out.length - 1];
    const b = dedup[i];
    const c = dedup[i + 1];
    const collinear =
      (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!collinear) out.push(b);
  }
  return out;
}

/**
 * Polyline vertices for an axis-aligned (right-angle) wire between two ports.
 * Each end first leaves its port in the side's facing direction (a short stub)
 * so the wire never doubles back under its own component; the two stub ends are
 * then joined with a single orthogonal bend.
 *
 * The bend turns perpendicular to the stub by default, which keeps the wire
 * clear of the component when the target sits "behind" the port. But when the
 * port faces toward the target, continuing straight along the stub axis merges
 * the stub into one leg and avoids a staircase — so we take that alternate when
 * it stays clear of the component and has fewer corners.
 */
export function orthogonalRoute(
  from: Point,
  to: Point,
  fromSide?: PortSide,
  toSide?: PortSide,
): Point[] {
  const fromFacing = fromSide ? PORT_FACING[fromSide] : { x: 0, y: 0 };
  const fromStub = portStub(from, fromSide);
  const toStub = portStub(to, toSide);
  const fromHorizontal = fromFacing.y === 0;

  const build = (bend: Point) =>
    [from, fromStub, bend, toStub, to].filter(
      (p, i, a) => i === 0 || p.x !== a[i - 1].x || p.y !== a[i - 1].y,
    );

  // Default: turn perpendicular to the stub's exit.
  const def = build(
    fromHorizontal
      ? { x: fromStub.x, y: toStub.y }
      : { x: toStub.x, y: fromStub.y },
  );

  // Alternate: continue along the stub axis. Only safe when the target stub is
  // further along the exit direction (so the leg doesn't reverse back over the
  // component). Use it when it genuinely simplifies the route.
  const straightSafe = fromHorizontal
    ? (toStub.x - fromStub.x) * fromFacing.x >= 0
    : (toStub.y - fromStub.y) * fromFacing.y >= 0;
  if (straightSafe) {
    const alt = build(
      fromHorizontal
        ? { x: toStub.x, y: fromStub.y }
        : { x: fromStub.x, y: toStub.y },
    );
    const altPruned = pruneCollinear(alt);
    if (altPruned.length < pruneCollinear(def).length) return altPruned;
  }
  return def;
}

/** SVG path string for {@link orthogonalRoute}. */
export function orthogonalPath(
  from: Point,
  to: Point,
  fromSide?: PortSide,
  toSide?: PortSide,
): string {
  return pointsToPath(orthogonalRoute(from, to, fromSide, toSide));
}

/** Clearance kept between a wire and another component's box. */
export const OBSTACLE_PAD = 6;

/**
 * Does an axis-aligned segment pass through `box`? The test is strict, so a
 * segment that only runs along an edge (e.g. a stub leaving a port on the box
 * boundary) does not count — only crossing the interior does.
 */
function segmentHitsBox(a: Point, b: Point, box: Box): boolean {
  const xMin = box.x - box.width / 2;
  const xMax = box.x + box.width / 2;
  const yMin = box.y - box.height / 2;
  const yMax = box.y + box.height / 2;
  const sx0 = Math.min(a.x, b.x);
  const sx1 = Math.max(a.x, b.x);
  const sy0 = Math.min(a.y, b.y);
  const sy1 = Math.max(a.y, b.y);
  return sx0 < xMax && sx1 > xMin && sy0 < yMax && sy1 > yMin;
}

function routeHitsBoxes(points: Point[], boxes: Box[]): boolean {
  const segments = toSegments(points);
  return boxes.some((box) =>
    segments.some((s) => segmentHitsBox(s.a, s.b, box)),
  );
}

/** Grow (or shrink, for negative `pad`) a box on every side. */
export function inflateBox(box: Box, pad: number): Box {
  return {
    x: box.x,
    y: box.y,
    width: box.width + 2 * pad,
    height: box.height + 2 * pad,
  };
}

/**
 * Orthogonal route that keeps clear of obstacle boxes. Returns the default
 * single-bend {@link orthogonalRoute} when it is already clear (or there are no
 * obstacles). Otherwise it searches Z routes that split at the stub lines, their
 * midpoint, or just outside each obstacle edge — so a wire can hug around a box,
 * including a component it connects to whose port is on the far side — and
 * returns the clear route with the fewest corners, falling back to the default
 * if none is clear. Boxes are pre-inflated by the caller; a wire's own end
 * components pass zero padding so the stub can still reach their ports.
 */
export function orthogonalRouteAvoiding(
  from: Point,
  to: Point,
  fromSide: PortSide | undefined,
  toSide: PortSide | undefined,
  obstacles: Box[],
): Point[] {
  const def = orthogonalRoute(from, to, fromSide, toSide);
  if (obstacles.length === 0 || !routeHitsBoxes(def, obstacles)) return def;

  const fromStub = portStub(from, fromSide);
  const toStub = portStub(to, toSide);

  // Split coordinates to try: the stub lines, their midpoint, and a hair outside
  // each obstacle edge (so a route can run around a box).
  const xs = new Set<number>([
    fromStub.x,
    toStub.x,
    (fromStub.x + toStub.x) / 2,
  ]);
  const ys = new Set<number>([
    fromStub.y,
    toStub.y,
    (fromStub.y + toStub.y) / 2,
  ]);
  for (const b of obstacles) {
    xs.add(b.x - b.width / 2 - 1);
    xs.add(b.x + b.width / 2 + 1);
    ys.add(b.y - b.height / 2 - 1);
    ys.add(b.y + b.height / 2 + 1);
  }

  const candidates: Point[][] = [];
  for (const sx of xs) {
    candidates.push(
      pruneCollinear([
        from,
        fromStub,
        { x: sx, y: fromStub.y },
        { x: sx, y: toStub.y },
        toStub,
        to,
      ]),
    );
  }
  for (const sy of ys) {
    candidates.push(
      pruneCollinear([
        from,
        fromStub,
        { x: fromStub.x, y: sy },
        { x: toStub.x, y: sy },
        toStub,
        to,
      ]),
    );
  }

  const clear = candidates.filter((r) => !routeHitsBoxes(r, obstacles));
  if (clear.length === 0) return def;
  clear.sort((a, b) => a.length - b.length);
  return clear[0];
}

/** Radius of the little semicircle drawn where a wire hops a crossing. */
const HOP_RADIUS = 6;

export interface Segment {
  a: Point;
  b: Point;
}

function toSegments(points: Point[]): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    segments.push({ a: points[i], b: points[i + 1] });
  }
  return segments;
}

const isHorizontal = (s: Segment) => s.a.y === s.b.y && s.a.x !== s.b.x;
const isVertical = (s: Segment) => s.a.x === s.b.x && s.a.y !== s.b.y;

/** Where a vertical segment crosses a horizontal one (exclusive), else null. */
function crossingX(h: Segment, v: Segment): number | null {
  const y = h.a.y;
  const vx = v.a.x;
  const [xLo, xHi] = [Math.min(h.a.x, h.b.x), Math.max(h.a.x, h.b.x)];
  const [yLo, yHi] = [Math.min(v.a.y, v.b.y), Math.max(v.a.y, v.b.y)];
  return vx > xLo && vx < xHi && y > yLo && y < yHi ? vx : null;
}

/**
 * Vertical obstacle segments standing in for the trunk lines at `trunkXs`,
 * spanning the full y-range of `routes` (with a little slack) so any horizontal
 * wire crossing a trunk is detected. Passed to {@link wirePathsWithHops} so
 * wires hop over the trunk lines they merely cross rather than reading as a
 * short. Returns `[]` when there are no routes to bound the span.
 */
export function trunkCrossingVerticals(
  trunkXs: number[],
  routes: Point[][],
): Segment[] {
  const ys = routes.flat().map((p) => p.y);
  if (ys.length === 0) return [];
  const yLo = Math.min(...ys) - 1;
  const yHi = Math.max(...ys) + 1;
  return trunkXs.map((x) => ({ a: { x, y: yLo }, b: { x, y: yHi } }));
}

/**
 * Build each wire's SVG path with small semicircular "hops" where its
 * horizontal segments cross another wire's vertical segments (and any
 * `extraVerticals`, e.g. trunk lines), so crossings read as over/under rather
 * than a merged junction. Only horizontal segments hop, and coincident
 * crossings collapse to one, so each crossing x gets exactly one hop. Returns a
 * map keyed by wire key.
 */
export function wirePathsWithHops(
  wires: { key: string; points: Point[] }[],
  extraVerticals: Segment[] = [],
  radius: number = HOP_RADIUS,
): Map<string, string> {
  const verticalsByWire = wires.map((w) =>
    toSegments(w.points).filter(isVertical),
  );
  const result = new Map<string, string>();

  wires.forEach((wire, wi) => {
    let path = `M ${wire.points[0].x} ${wire.points[0].y}`;
    for (const segment of toSegments(wire.points)) {
      if (!isHorizontal(segment)) {
        path += ` L ${segment.b.x} ${segment.b.y}`;
        continue;
      }
      const dir = segment.b.x > segment.a.x ? 1 : -1;
      const y = segment.a.y;
      // Dedupe so a trunk line and an implicit wire sharing an x hop just once.
      const crossings = new Set<number>();
      verticalsByWire.forEach((verticals, vi) => {
        if (vi === wi) return;
        for (const v of verticals) {
          const cx = crossingX(segment, v);
          if (cx != null) crossings.add(cx);
        }
      });
      for (const v of extraVerticals) {
        const cx = crossingX(segment, v);
        if (cx != null) crossings.add(cx);
      }
      const ordered = [...crossings].sort((p, q) => (p - q) * dir);
      for (const cx of ordered) {
        path += ` L ${cx - radius * dir} ${y}`;
        path += ` A ${radius} ${radius} 0 0 ${dir > 0 ? 1 : 0} ${cx + radius * dir} ${y}`;
      }
      path += ` L ${segment.b.x} ${segment.b.y}`;
    }
    result.set(wire.key, path);
  });

  return result;
}

/**
 * Points where wires genuinely connect and should carry a junction dot — a real
 * multi-wire join where 3+ segment ends meet at the same point (a star, or a
 * straight-through wire plus a branch that all terminate there).
 *
 * Connections here are always port-to-port, so a wire merely *passing through*
 * another wire's endpoint (or span) is a coincidental overlap, not a tap: it has
 * no endpoint there, so it gets no dot and reads as an overlap/crossover. This
 * is what keeps a connection routed across a row of components from "shorting"
 * to every port it passes. A plain crossover and a simple bend
 * (degree ≤ 2) likewise get no dot.
 */
export function wireJunctions(routes: Point[][]): Point[] {
  const segments = routes.flatMap(toSegments);
  const candidates = new Map<string, Point>();
  for (const route of routes) {
    for (const p of route) candidates.set(`${p.x},${p.y}`, p);
  }

  const junctions: Point[] = [];
  for (const p of candidates.values()) {
    let endpoints = 0;
    for (const s of segments) {
      if (
        (s.a.x === p.x && s.a.y === p.y) ||
        (s.b.x === p.x && s.b.y === p.y)
      ) {
        endpoints++;
      }
    }
    if (endpoints >= 3) junctions.push(p);
  }
  return junctions;
}

/** Perpendicular spacing between wires sharing a channel. */
const LANE_GAP = 8;

interface LaneSegment {
  wire: number;
  i: number; // segment runs from points[i] to points[i+1]
  lo: number;
  hi: number;
}

/** Push overlapping group members onto evenly-spaced lanes around their shared coord. */
function assignLanes(
  members: LaneSegment[],
  axis: "x" | "y",
  gap: number,
  dx: number[][],
  dy: number[][],
): void {
  // Sort by span start, then sweep to cluster members whose ranges overlap.
  const sorted = [...members].sort((a, b) => a.lo - b.lo);
  let cluster: LaneSegment[] = [];
  let clusterHi = -Infinity;

  const flush = () => {
    const wires = new Set(cluster.map((s) => s.wire));
    if (cluster.length >= 2 && wires.size >= 2) {
      const ordered = [...cluster].sort((a, b) => a.wire - b.wire || a.i - b.i);
      const m = ordered.length;
      ordered.forEach((s, k) => {
        const delta = (k - (m - 1) / 2) * gap;
        const target = axis === "x" ? dx : dy;
        target[s.wire][s.i] += delta;
        target[s.wire][s.i + 1] += delta;
      });
    }
    cluster = [];
    clusterHi = -Infinity;
  };

  for (const s of sorted) {
    if (cluster.length === 0 || s.lo < clusterHi) {
      cluster.push(s);
      clusterHi = Math.max(clusterHi, s.hi);
    } else {
      flush();
      cluster.push(s);
      clusterHi = s.hi;
    }
  }
  flush();
}

/**
 * Spread wires that share a channel into separate lanes so overlapping parallel
 * runs don't read as a single line. Collinear segments from different wires whose
 * spans overlap are nudged perpendicular onto evenly-spaced lanes. Only interior
 * segments move — a segment touching a terminal (port) vertex stays put, which
 * keeps endpoints anchored and the route axis-aligned. Deterministic: lanes are
 * ordered by wire then segment. Pure; returns new routes.
 */
export function separateLanes(
  routes: Point[][],
  gap: number = LANE_GAP,
): Point[][] {
  const out = routes.map((r) => r.map((p) => ({ ...p })));
  const dx = out.map((r) => r.map(() => 0));
  const dy = out.map((r) => r.map(() => 0));

  const verticalsByX = new Map<number, LaneSegment[]>();
  const horizontalsByY = new Map<number, LaneSegment[]>();
  const bucket = (
    map: Map<number, LaneSegment[]>,
    key: number,
    s: LaneSegment,
  ) => {
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  };

  out.forEach((pts, wire) => {
    for (let i = 0; i + 1 < pts.length; i++) {
      // Skip segments touching a terminal (port) vertex — those can't move.
      if (i === 0 || i + 1 === pts.length - 1) continue;
      const a = pts[i];
      const b = pts[i + 1];
      if (a.x === b.x && a.y !== b.y) {
        bucket(verticalsByX, a.x, {
          wire,
          i,
          lo: Math.min(a.y, b.y),
          hi: Math.max(a.y, b.y),
        });
      } else if (a.y === b.y && a.x !== b.x) {
        bucket(horizontalsByY, a.y, {
          wire,
          i,
          lo: Math.min(a.x, b.x),
          hi: Math.max(a.x, b.x),
        });
      }
    }
  });

  for (const members of verticalsByX.values())
    assignLanes(members, "x", gap, dx, dy);
  for (const members of horizontalsByY.values())
    assignLanes(members, "y", gap, dx, dy);

  out.forEach((pts, wire) => {
    pts.forEach((p, idx) => {
      if (idx === 0 || idx === pts.length - 1) return; // never move a port
      p.x += dx[wire][idx];
      p.y += dy[wire][idx];
    });
  });
  return out;
}

/** A component placed at a logical anchor, tagged with the line it sits on. */
export interface PlacedComponent {
  id: string;
  lineId: string;
  x: number;
  y: number;
}

/**
 * Orthogonal route down a trunk between two stacked component anchors. When the
 * anchors share an x it stays a single straight vertical; otherwise it jogs
 * across at the vertical midpoint (a Z) so the horizontal leg sits in the gap
 * between the components rather than slicing through either one.
 */
export function trunkRoute(from: Point, to: Point): Point[] {
  if (from.x === to.x) return [from, to];
  const midY = (from.y + to.y) / 2;
  return [from, { x: from.x, y: midY }, { x: to.x, y: midY }, to];
}

/**
 * Implicit connections: components attached to the same trunk line are joined
 * down it. Within each line, components are ordered top-to-bottom by their y
 * and consecutive pairs become a wire routed orthogonally.
 */
export function implicitWires(placed: PlacedComponent[]): Wire[] {
  const byLine = new Map<string, PlacedComponent[]>();
  for (const item of placed) {
    const list = byLine.get(item.lineId);
    if (list) list.push(item);
    else byLine.set(item.lineId, [item]);
  }

  const wires: Wire[] = [];
  for (const list of byLine.values()) {
    const ordered = [...list].sort((a, b) => a.y - b.y);
    for (let i = 0; i + 1 < ordered.length; i++) {
      const a = ordered[i];
      const b = ordered[i + 1];
      const from = { x: a.x, y: a.y };
      const to = { x: b.x, y: b.y };
      const points = trunkRoute(from, to);
      wires.push({
        key: `${a.id}-${b.id}`,
        from,
        to,
        points,
        path: pointsToPath(points),
      });
    }
  }
  return wires;
}

// Explicit (port-to-port) wires --------------------------------------------
// No DB table yet — the drawing UI and persistence land in Phase 3. This is the
// render-ready data model + resolver.

/** A reference to one endpoint of an explicit wire: a component's port. */
export interface WirePortRef {
  componentId: string;
  port: Port;
}

export interface ExplicitWire {
  id: string;
  from: WirePortRef;
  to: WirePortRef;
}

/**
 * Resolve explicit wires to drawable segments using a port-locator. Wires whose
 * endpoints can't be resolved (missing component/port) are dropped.
 */
/** Where a port resolves to: an absolute point and the side it visually faces. */
export interface ResolvedPort {
  point: Point;
  side: PortSide;
}

/** A component footprint a wire should route around, tagged by component. */
export interface WireObstacle {
  componentId: string;
  box: Box;
}

export function resolveExplicitWires(
  wires: ExplicitWire[],
  portAt: (componentId: string, port: Port) => ResolvedPort | null,
  obstacles: WireObstacle[] = [],
): Wire[] {
  const resolved: Wire[] = [];
  for (const wire of wires) {
    const from = portAt(wire.from.componentId, wire.from.port);
    const to = portAt(wire.to.componentId, wire.to.port);
    if (from && to) {
      // Every component is an obstacle. Other components get a clearance pad;
      // the wire's own two end components get none, so the route can still reach
      // their ports (a stub on the boundary doesn't count as crossing) but is
      // kept out of their bodies — e.g. a port on the far side of a component.
      const boxes = obstacles.map((o) => {
        const own =
          o.componentId === wire.from.componentId ||
          o.componentId === wire.to.componentId;
        return inflateBox(o.box, own ? 0 : OBSTACLE_PAD);
      });
      const points = orthogonalRouteAvoiding(
        from.point,
        to.point,
        from.side,
        to.side,
        boxes,
      );
      resolved.push({
        key: wire.id,
        from: from.point,
        to: to.point,
        points,
        path: pointsToPath(points),
      });
    }
  }
  return resolved;
}
