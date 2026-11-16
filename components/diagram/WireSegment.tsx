import { useMemo } from "react";
import {
  wireAppearance,
  sampleWirePath,
  WIRE_CONSTRUCTION_META,
  type WireConstruction,
} from "@/lib/diagram/wireAppearance";
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
  construction?: WireConstruction;
  /** Precomputed path (e.g. orthogonal routing); defaults to a straight segment. */
  path?: string;
  label?: string | null;
  selectionLabel?: string;
  showLabel?: boolean;
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
  construction = "unspecified",
  path,
  label,
  selectionLabel,
  showLabel = false,
  onSelect,
  selected = false,
  layer = "both",
}: WireSegmentProps) {
  const style = VARIANT_STYLE[variant];
  const d = path ?? wirePath(from, to);
  const appearance = useMemo(
    () =>
      layer === "hit"
        ? { strokes: [], width: WIRE_CONSTRUCTION_META[construction].width }
        : wireAppearance(d, construction),
    [d, construction, layer],
  );
  const showVisual = layer !== "hit";
  const labelPoint = useMemo(() => {
    if (!showLabel || !label || !showVisual) return null;
    const samples = sampleWirePath(d);
    const middle = Math.floor((samples?.length ?? 0) / 2);
    const point = samples?.[middle] ?? {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2,
    };
    const before = samples?.[Math.max(0, middle - 1)] ?? {
      x: from.x,
      y: from.y,
    };
    const after = samples?.[
      Math.min((samples?.length ?? 1) - 1, middle + 1)
    ] ?? { x: to.x, y: to.y };
    const vertical =
      Math.abs(after.y - before.y) > Math.abs(after.x - before.x);
    return {
      x: point.x + (vertical ? 14 : 0),
      y: point.y + (vertical ? 4 : -12),
      vertical,
    };
  }, [d, from.x, from.y, to.x, to.y, label, showLabel, showVisual]);
  const showHit = layer !== "visual" && Boolean(onSelect);
  return (
    <>
      {showVisual && selected ? (
        <path
          d={d}
          fill="none"
          stroke="#2563eb"
          strokeWidth={
            construction === "unspecified" ? 6 : appearance.width + 5
          }
          strokeOpacity={0.3}
          strokeLinecap="round"
          pointerEvents="none"
        />
      ) : null}
      {showVisual
        ? appearance.strokes.map((stroke, i) => (
            <path
              key={i}
              d={stroke.d}
              fill={stroke.fill ? "#ffffff" : "none"}
              stroke={stroke.background ? "#ffffff" : style.stroke}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin={
                construction === "unspecified" ? undefined : "round"
              }
              strokeDasharray={stroke.dash ?? style.strokeDasharray}
              pointerEvents="none"
            />
          ))
        : null}
      {labelPoint ? (
        <text
          x={labelPoint.x}
          y={labelPoint.y}
          textAnchor={labelPoint.vertical ? "start" : "middle"}
          fontSize={11}
          fill={style.stroke}
          stroke="#ffffff"
          strokeWidth={4}
          paintOrder="stroke"
          strokeLinejoin="round"
          pointerEvents="none"
        >
          {label}
        </text>
      ) : null}
      {showHit ? (
        // Invisible fat path widens the click target for a thin wire.
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(14, appearance.width + 6)}
          strokeLinecap="round"
          pointerEvents="stroke"
          style={{ cursor: "pointer" }}
          role="button"
          tabIndex={0}
          aria-label={selectionLabel ?? (label ? `Wire: ${label}` : "Wire")}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onSelect?.();
            }
          }}
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
          construction={wire.properties?.construction ?? wire.construction}
          label={wire.properties?.label}
          selectionLabel={wire.selectionLabel}
          showLabel={wire.properties?.show_label}
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
