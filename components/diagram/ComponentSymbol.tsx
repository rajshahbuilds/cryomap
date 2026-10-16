import type { ReactNode } from "react";
import type { Component, CustomComponentDef } from "@/lib/types";
import type { Size } from "@/lib/diagram/camera";
import { localPortPositions } from "@/lib/diagram/ports";
import type { PlacedPort } from "@/lib/diagram/ports";
import {
  componentPorts as symbolPorts,
  componentPortLead,
  componentSize as symbolSize,
  effectiveRotation,
  type FlowOrientation,
} from "@/lib/diagram/componentGeometry";
import { COMPONENT_LIBRARY } from "@/lib/constants/componentLibrary";
import { SYMBOL_GLYPHS } from "./symbolGlyphs";

/**
 * The caption's primary line: the instance label, falling back to a built-in's
 * type name. Custom components show their def name *inside* the box (see
 * {@link CustomLabel}), so their caption carries only an explicit instance label
 * — `null` here omits the line entirely rather than repeating the box's name.
 */
function captionLabel(component: Component): string | null {
  if (component.label) return component.label;
  if (component.component_type === "custom") return null;
  return COMPONENT_LIBRARY[component.component_type].label;
}

/** The name drawn inside a custom component's box — its on-canvas identity. */
function customBoxLabel(def?: CustomComponentDef | null): string {
  return def?.name ?? "Custom";
}

/**
 * Types that render their value *inside* the glyph (e.g. the attenuator shows
 * "−20 dB" in its box), so the caption below omits the value to avoid repeating
 * it.
 */
function showsValueInBox(component: Component): boolean {
  return component.component_type === "attenuator";
}

/**
 * Surface-colored halo (stroke painted behind the fill) so caption text stays
 * legible over lines, stage bands, and the dot grid without measuring text.
 */
const CAPTION_HALO = {
  strokeWidth: 3,
  paintOrder: "stroke" as const,
  strokeLinejoin: "round" as const,
};

/** Vertical offset of the caption below the symbol's center. */
function captionOffset(component: Component, def?: CustomComponentDef | null) {
  const size = symbolSize(component, def);
  return Math.max(size.width, size.height) / 2 + 16;
}

/**
 * A component's caption (label + optional value), drawn with a halo for
 * legibility. In the editor these render in a top layer (above all glyphs) so a
 * component can never hide another's label; standalone (e.g. read-only previews)
 * `ComponentSymbol` renders it inline.
 */
export function ComponentCaption({
  component,
  def,
  x = 0,
  y = 0,
}: {
  component: Component;
  def?: CustomComponentDef | null;
  x?: number;
  y?: number;
}) {
  const label = captionLabel(component);
  const offset = captionOffset(component, def);
  return (
    <>
      {label ? (
        <text
          x={x}
          y={y + offset}
          textAnchor="middle"
          fontSize={13}
          fontWeight={600}
          className="fill-foreground stroke-surface"
          {...CAPTION_HALO}
        >
          {label}
        </text>
      ) : null}
      {component.value && !showsValueInBox(component) ? (
        <text
          x={x}
          y={y + offset + (label ? 16 : 0)}
          textAnchor="middle"
          fontSize={12}
          className="fill-muted stroke-surface"
          {...CAPTION_HALO}
        >
          {component.value}
        </text>
      ) : null}
    </>
  );
}

/** A plain box glyph for custom components (dimensions come from the def). */
function CustomGlyph({ size }: { size: Size }) {
  return (
    <rect
      x={-size.width / 2}
      y={-size.height / 2}
      width={size.width}
      height={size.height}
      rx={6}
      fill="#ffffff"
      stroke="#1a1d27"
      strokeWidth={2}
    />
  );
}

const BOX_LABEL_FONT = 12;
/** Horizontal padding kept clear inside the box so text doesn't touch the edge. */
const BOX_LABEL_PAD = 8;

/**
 * Truncate a label with an ellipsis so it fits the box width. Width per glyph is
 * estimated (SVG can't measure mid-render); the box is the source of truth, so a
 * long name is clipped rather than allowed to spill past the outline.
 */
function fitBoxLabel(text: string, width: number): string {
  const maxChars = Math.floor(
    (width - BOX_LABEL_PAD) / (BOX_LABEL_FONT * 0.58),
  );
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return "…";
  return text.slice(0, maxChars - 1).trimEnd() + "…";
}

/** The custom component's name, centered inside its box (its only identifier). */
function CustomLabel({ size, label }: { size: Size; label: string }) {
  return (
    <text
      x={0}
      y={0}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={BOX_LABEL_FONT}
      fontWeight={600}
      fill="#1a1d27"
      stroke="none"
    >
      {fitBoxLabel(label, size.width)}
    </text>
  );
}

/** The box-edge end of a port's lead stub (the port itself is `lead` out). */
function leadBase({ port, x, y }: PlacedPort, lead: number) {
  switch (port.side) {
    case "left":
      return { x: x + lead, y };
    case "right":
      return { x: x - lead, y };
    case "top":
      return { x, y: y + lead };
    case "bottom":
      return { x, y: y - lead };
  }
}

/** Lead stubs from the box edge out to each port (custom components). */
function PortLeads({ ports, lead }: { ports: PlacedPort[]; lead: number }) {
  return (
    <>
      {ports.map((p) => {
        const base = leadBase(p, lead);
        return (
          <line
            key={`${p.port.side}-${p.port.index}`}
            x1={base.x}
            y1={base.y}
            x2={p.x}
            y2={p.y}
            stroke="#1a1d27"
            strokeWidth={2}
            strokeLinecap="round"
          />
        );
      })}
    </>
  );
}

interface ComponentSymbolProps {
  component: Component;
  /** Required when `component_type === "custom"`. */
  def?: CustomComponentDef | null;
  /** Anchor center in logical coords (defaults to the origin). */
  x?: number;
  y?: number;
  /**
   * The sheet's flow direction, which drives the built-in base turn. Defaults to
   * `vertical` (fridge) for standalone callers.
   */
  orientation?: FlowOrientation;
  /**
   * Render the label/value caption inline. The editor sets this false and draws
   * captions in a top layer (see {@link ComponentCaption}); standalone callers
   * leave it true.
   */
  showCaption?: boolean;
  /** Name of the fridge line a `fridge_port` links to — drawn in its tag. */
  linkedLineName?: string | null;
}

/**
 * Renders a component's symbol: the type's glyph (or a custom box), its ports,
 * and — when `showCaption` — a label/value caption. The glyph + ports rotate
 * with the component's effective rotation (its stored rotation plus any base
 * turn for left/right-only built-ins); the caption stays upright.
 */
export function ComponentSymbol({
  component,
  def,
  x = 0,
  y = 0,
  orientation = "vertical",
  showCaption = true,
  linkedLineName = null,
}: ComponentSymbolProps) {
  const size = symbolSize(component, def);
  const lead = componentPortLead(component);
  const ports = localPortPositions(symbolPorts(component, def), size, lead);

  // The frame (leads + outline) follows the component's effective rotation; the
  // icon (inner detail) follows only its stored rotation, so the automatic
  // vertical turn for left/right-only components leaves the icon upright.
  let frame: ReactNode;
  let icon: ReactNode = null;
  if (component.component_type === "custom") {
    frame = <CustomGlyph size={size} />;
    icon = <CustomLabel size={size} label={customBoxLabel(def)} />;
  } else {
    ({ frame, icon } = SYMBOL_GLYPHS[component.component_type](
      { w: size.width, h: size.height },
      { value: component.value, linkedLineName },
    ));
  }

  const mirror = component.mirrored ? -1 : 1;

  return (
    <g
      data-component-id={component.id}
      data-component-type={component.component_type}
    >
      <g
        transform={`translate(${x} ${y}) rotate(${effectiveRotation(component, orientation)}) scale(${mirror} 1)`}
      >
        {frame}
        {lead > 0 ? <PortLeads ports={ports} lead={lead} /> : null}
        {ports.map((p) => (
          <circle
            key={`${p.port.side}-${p.port.index}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#1a1d27"
          />
        ))}
      </g>

      {icon ? (
        <g
          transform={`translate(${x} ${y}) rotate(${component.rotation}) scale(${mirror} 1)`}
        >
          {icon}
        </g>
      ) : null}

      {showCaption ? (
        <ComponentCaption component={component} def={def} x={x} y={y} />
      ) : null}
    </g>
  );
}
