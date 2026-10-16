import type { Point } from "@/lib/diagram/camera";
import { wirePath, type Wire } from "@/lib/diagram/wires";

/** Colour of wires and their junction dots. */
const WIRE_STROKE = "#1a1d27";

export type WireVariant = "implicit" | "explicit";

const VARIANT_STYLE: Record<
  WireVariant,
  { stroke: string; strokeDasharray?: string }
> = {
  implicit: { stroke: WIRE_STROKE },
  explicit: { stroke: WIRE_STROKE },
};

/**
 * Which parts to render. Explicit wires split across two layers: `visual` on
 * top of components (so a wire is never hidden) and `hit` beneath them (so the
 * fat click target doesn't block hovering/selecting components). `both` (the
 * default) draws everything in one place — used for implicit wires + previews.
 */
export type WireLayer = "both" | "visual" | "hit";

interface WireSegmentProps {
  from: Point;
  to: Point;
  variant?: WireVariant;
  /** Precomputed path (e.g. orthogonal routing); defaults to a straight segment. */
  path?: string;
  /** When set, the wire is selectable: a fat hit-path invokes this on click. */
  onSelect?: () => void;
  /** Renders the selected highlight beneath the wire. */
  selected?: boolean;
  layer?: WireLayer;
}

/** A single wire path between two logical points. */
export function WireSegment({
  from,
  to,
  variant = "implicit",
  path,
  onSelect,
  selected = false,
  layer = "both",
}: WireSegmentProps) {
  const style = VARIANT_STYLE[variant];
  const d = path ?? wirePath(from, to);
  const showVisual = layer !== "hit";
  const showHit = layer !== "visual" && Boolean(onSelect);
  return (
    <>
      {showVisual && selected ? (
        <path
          d={d}
          fill="none"
          stroke="#2563eb"
          strokeWidth={6}
          strokeOpacity={0.3}
          strokeLinecap="round"
          pointerEvents="none"
        />
      ) : null}
      {showVisual ? (
        <path
          d={d}
          fill="none"
          stroke={style.stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray={style.strokeDasharray}
          pointerEvents="none"
        />
      ) : null}
      {showHit ? (
        // Invisible fat path widens the click target for a thin wire.
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={14}
          strokeLinecap="round"
          pointerEvents="stroke"
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.();
          }}
        />
      ) : null}
    </>
  );
}

interface WireSegmentsProps {
  wires: Wire[];
  variant?: WireVariant;
  /** When set, each wire is selectable; called with the wire's key (id). */
  onSelect?: (key: string) => void;
  /** The currently selected wire key, if any. */
  selectedKey?: string | null;
  layer?: WireLayer;
}

/**
 * Renders a set of resolved wires as a layer. Each wire's `path` already
 * carries any over/under crossing hops — those are computed across all wires in
 * `assembleDiagram` so crossings read consistently between layers.
 */
export function WireSegments({
  wires,
  variant = "implicit",
  onSelect,
  selectedKey,
  layer = "both",
}: WireSegmentsProps) {
  return (
    <g data-testid={`wires-${variant}`}>
      {wires.map((wire) => (
        <WireSegment
          key={wire.key}
          from={wire.from}
          to={wire.to}
          path={wire.path}
          variant={variant}
          onSelect={onSelect ? () => onSelect(wire.key) : undefined}
          selected={selectedKey === wire.key}
          layer={layer}
        />
      ))}
    </g>
  );
}

/** Filled dots marking where wires connect/branch (see {@link wireJunctions}). */
export function WireJunctions({ points }: { points: Point[] }) {
  return (
    <g data-testid="wire-junctions">
      {points.map((p) => (
        <circle
          key={`${p.x},${p.y}`}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={WIRE_STROKE}
          pointerEvents="none"
        />
      ))}
    </g>
  );
}
