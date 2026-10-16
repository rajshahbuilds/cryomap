import type { ReactNode } from "react";
import type { BuiltInComponentType } from "@/lib/types";

/**
 * SVG glyphs for the built-in component types, each drawn in origin-centered
 * symbol-local coordinates within a `w × h` box. Adding a type is a single new
 * entry — no other glyph is affected. ComponentSymbol applies position,
 * rotation, ports, and labels around these.
 *
 * Each glyph splits into two parts: the **frame** — leads and the
 * outline silhouette — follows the component's on-canvas orientation, while the
 * **icon** — the inner symbol detail — is drawn at the component's own rotation
 * only. So a left/right-only component turns vertical (its leads/ports move to
 * top–bottom) while its inner diagram stays upright. A glyph with no separable
 * inner detail leaves `icon` null and renders entirely as frame.
 */

export type GlyphSize = { w: number; h: number };
export type GlyphParts = { frame: ReactNode; icon: ReactNode };
/** Instance data a glyph may fold into its icon (e.g. an attenuator's value). */
export type GlyphContext = {
  value?: string | null;
  /** The name of the fridge line a `fridge_port` links to, if any. */
  linkedLineName?: string | null;
};
export type Glyph = (size: GlyphSize, ctx?: GlyphContext) => GlyphParts;

const STROKE = {
  stroke: "#1a1d27",
  strokeWidth: 2,
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const FILLED = { ...STROKE, fill: "#ffffff" } as const;

/** Horizontal lead stubs from the left/right edges to the body. */
function LeadsLR({ hw, bodyHW }: { hw: number; bodyHW: number }) {
  return (
    <>
      <line x1={-hw} y1={0} x2={-bodyHW} y2={0} {...STROKE} />
      <line x1={bodyHW} y1={0} x2={hw} y2={0} {...STROKE} />
    </>
  );
}

/** A centered square box, inset from the symbol's smaller half-dimension. */
function boxedFrame(w: number, h: number, inset = 10): ReactNode {
  const hw = w / 2;
  const b = Math.min(w, h) / 2 - inset;
  return (
    <>
      <LeadsLR hw={hw} bodyHW={b} />
      <rect x={-b} y={-b} width={b * 2} height={b * 2} {...FILLED} />
    </>
  );
}

/** A filter: a square box (frame) with its response curve upright (icon). */
function filter(w: number, h: number, points: string): GlyphParts {
  return {
    frame: boxedFrame(w, h),
    icon: <polyline points={points} {...STROKE} />,
  };
}

/** Curve points for a filter, scaled to the square box. */
function curve(w: number, h: number, spec: (cx: number, cy: number) => string) {
  const b = Math.min(w, h) / 2 - 10;
  return spec(b * 0.7, b * 0.6);
}

/**
 * An amplifier: leads + a triangle pointing along the signal flow. The triangle
 * alone reads as an amplifier, so there's no inner letter.
 */
function amp(w: number, h: number): GlyphParts {
  const hw = w / 2;
  const bw = w / 2 - 8;
  const bh = h / 2 - 6;
  return {
    frame: (
      <>
        <LeadsLR hw={hw} bodyHW={bw} />
        <path d={`M ${-bw} ${-bh} L ${bw} 0 L ${-bw} ${bh} Z`} {...FILLED} />
      </>
    ),
    icon: null,
  };
}

/**
 * A signal I/O port marker: a single-lead pentagon "flag" (the standard
 * schematic I/O symbol) whose point encodes signal direction — toward the
 * connection (circuit) for an input, away for an output, both ends for
 * bidirectional. Wholly in the frame (icon null) so the arrow turns with the
 * component's orientation; the type label rides along as the caption.
 */
function ioPort(w: number, h: number, dir: "in" | "out" | "both"): GlyphParts {
  const hw = w / 2;
  const bw = w / 2 - 8;
  const bh = h / 2 - 6;
  const k = Math.min(bw, bh); // depth of each pointed end
  let points: string;
  if (dir === "in") {
    // Point toward the port (left = the connected circuit).
    points = `${bw},${-bh} ${bw},${bh} ${-bw + k},${bh} ${-bw},0 ${-bw + k},${-bh}`;
  } else if (dir === "out") {
    // Point away from the port (right = out of the fridge).
    points = `${-bw},${-bh} ${bw - k},${-bh} ${bw},0 ${bw - k},${bh} ${-bw},${bh}`;
  } else {
    // Pointed at both ends.
    points = `${-bw},0 ${-bw + k},${-bh} ${bw - k},${-bh} ${bw},0 ${bw - k},${bh} ${-bw + k},${bh}`;
  }
  return {
    frame: (
      <>
        <line x1={-hw} y1={0} x2={-bw} y2={0} {...STROKE} />
        <polygon points={points} {...FILLED} />
      </>
    ),
    icon: null,
  };
}

/**
 * Y offset of the k-th of n ports spread evenly along a vertical side of height
 * `h`, matching `localPortPositions` — so a glyph's leads meet the port dots.
 */
function portY(k: number, n: number, h: number): number {
  return -h / 2 + ((k + 1) / (n + 1)) * h;
}

/** A rounded instrument box, inset from the full w×h. */
function instrumentBox(w: number, h: number): ReactNode {
  const bw = w / 2 - 6;
  const bh = h / 2 - 8;
  return (
    <rect x={-bw} y={-bh} width={bw * 2} height={bh * 2} rx={4} {...FILLED} />
  );
}

/** Centered upright label (kept in the icon layer so it never rotates). */
function GlyphLabel({ text }: { text: string }) {
  return (
    <text
      x={0}
      y={0}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={700}
      fill="#1a1d27"
      stroke="none"
    >
      {text}
    </text>
  );
}

export const SYMBOL_GLYPHS: Record<BuiltInComponentType, Glyph> = {
  // An attenuator shows its value (e.g. "−20 dB") inside the box; with no value
  // set it's just an empty box (no icon).
  attenuator: ({ w, h }, ctx) => {
    const value = ctx?.value?.trim();
    return {
      frame: boxedFrame(w, h),
      icon: value ? <GlyphLabel text={value} /> : null,
    };
  },

  filter_lp: ({ w, h }) =>
    filter(
      w,
      h,
      curve(w, h, (cx, cy) => `${-cx},${-cy} 0,${-cy} ${cx},${cy}`),
    ),

  filter_hp: ({ w, h }) =>
    filter(
      w,
      h,
      curve(w, h, (cx, cy) => `${-cx},${cy} 0,${-cy} ${cx},${-cy}`),
    ),

  filter_bp: ({ w, h }) =>
    filter(
      w,
      h,
      curve(
        w,
        h,
        (cx, cy) =>
          `${-cx},${cy} ${-cx * 0.35},${-cy} ${cx * 0.35},${-cy} ${cx},${cy}`,
      ),
    ),

  dc_block: ({ w, h }) => {
    const hw = w / 2;
    const gap = 4;
    const ph = Math.min(w, h) / 2 - 12;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-gap} y2={0} {...STROKE} />
          <line x1={gap} y1={0} x2={hw} y2={0} {...STROKE} />
        </>
      ),
      icon: (
        <>
          <line x1={-gap} y1={-ph} x2={-gap} y2={ph} {...STROKE} />
          <line x1={gap} y1={-ph} x2={gap} y2={ph} {...STROKE} />
        </>
      ),
    };
  },

  feedthrough: ({ w, h }) => {
    const hw = w / 2;
    const hh = Math.min(w, h) / 2 - 4;
    return {
      frame: <line x1={-hw} y1={0} x2={hw} y2={0} {...STROKE} />,
      icon: (
        <>
          <line x1={0} y1={-hh} x2={0} y2={hh} {...STROKE} strokeWidth={3} />
          <circle cx={0} cy={0} r={5} {...FILLED} />
        </>
      ),
    };
  },

  amplifier_hemt: ({ w, h }) => amp(w, h),
  amplifier_roomtemp: ({ w, h }) => amp(w, h),
  amplifier_parametric: ({ w, h }) => amp(w, h),

  circulator: ({ w, h }) => {
    const hw = w / 2;
    const r = Math.min(w, h) / 2 - 8;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-r} y2={0} {...STROKE} />
          <line x1={r} y1={0} x2={hw} y2={0} {...STROKE} />
          <line x1={0} y1={r} x2={0} y2={h / 2} {...STROKE} />
          <circle cx={0} cy={0} r={r} {...FILLED} />
          <path
            d={`M ${r * 0.5} ${-r * 0.4} A ${r * 0.62} ${r * 0.62} 0 1 1 ${-r * 0.4} ${r * 0.5}`}
            {...STROKE}
          />
          <path
            d={`M ${-r * 0.62} ${r * 0.2} L ${-r * 0.4} ${r * 0.5} L ${-r * 0.18} ${r * 0.32}`}
            {...STROKE}
          />
        </>
      ),
      icon: null,
    };
  },

  isolator: ({ w, h }) => {
    const hw = w / 2;
    const r = Math.min(w, h) / 2 - 8;
    // Directional: the arrow turns with the component so it points downstream.
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-r} y2={0} {...STROKE} />
          <line x1={r} y1={0} x2={hw} y2={0} {...STROKE} />
          <circle cx={0} cy={0} r={r} {...FILLED} />
          <line x1={-r * 0.5} y1={0} x2={r * 0.5} y2={0} {...STROKE} />
          <path
            d={`M ${r * 0.2} ${-5} L ${r * 0.55} 0 L ${r * 0.2} 5`}
            {...STROKE}
          />
        </>
      ),
      icon: null,
    };
  },

  directional_coupler: ({ w, h }) => {
    const hw = w / 2;
    const hh = h / 2;
    const bw = w / 2 - 6;
    const bh = h / 2 - 10;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-bw} y2={0} {...STROKE} />
          <line x1={bw} y1={0} x2={hw} y2={0} {...STROKE} />
          <line x1={0} y1={-bh} x2={0} y2={-hh} {...STROKE} />
          <line x1={0} y1={bh} x2={0} y2={hh} {...STROKE} />
          <rect x={-bw} y={-bh} width={bw * 2} height={bh * 2} {...FILLED} />
          <line x1={-bw + 4} y1={-5} x2={bw - 4} y2={-5} {...STROKE} />
          <line x1={-bw + 4} y1={5} x2={bw - 4} y2={5} {...STROKE} />
        </>
      ),
      icon: null,
    };
  },

  power_splitter: ({ w, h }) => {
    const hw = w / 2;
    const bw = Math.min(w, h) / 2 - 10;
    const bh = Math.min(w, h) / 2 - 8;
    const y0 = -h / 2 + h / 3;
    const y1 = -h / 2 + (2 * h) / 3;
    // Directional: the splitter turns with the component (one in, two out).
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-bw} y2={0} {...STROKE} />
          <path d={`M ${-bw} ${-bh} L ${bw} 0 L ${-bw} ${bh} Z`} {...FILLED} />
          <line x1={bw} y1={0} x2={hw} y2={y0} {...STROKE} />
          <line x1={bw} y1={0} x2={hw} y2={y1} {...STROKE} />
        </>
      ),
      icon: null,
    };
  },

  sma_connector: ({ w, h }) => {
    const hw = w / 2;
    const r = Math.min(w, h) / 2 - 8;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-r} y2={0} {...STROKE} />
          <circle cx={0} cy={0} r={r} {...FILLED} />
        </>
      ),
      icon: <circle cx={0} cy={0} r={2.5} fill="#1a1d27" stroke="none" />,
    };
  },

  thermometer: ({ w, h }) => {
    const hw = w / 2;
    const top = -Math.min(w, h) / 2 + 8;
    const bulbY = Math.min(w, h) / 2 - 10;
    return {
      frame: <line x1={-hw} y1={0} x2={4} y2={0} {...STROKE} />,
      icon: (
        <>
          <line x1={4} y1={top} x2={4} y2={bulbY - 6} {...STROKE} />
          <circle cx={4} cy={bulbY} r={6} {...FILLED} />
          <circle cx={4} cy={bulbY} r={2.5} fill="#1a1d27" stroke="none" />
        </>
      ),
    };
  },

  heater: ({ w }) => {
    const hw = w / 2;
    return {
      frame: <line x1={-hw} y1={0} x2={-16} y2={0} {...STROKE} />,
      icon: (
        <>
          <polyline points={`-16,0 -12,-8 -4,8 4,-8 12,8 16,0`} {...STROKE} />
          <line x1={16} y1={-7} x2={16} y2={7} {...STROKE} />
        </>
      ),
    };
  },

  dut: ({ w, h }) => {
    const hh = h / 2;
    const bw = w / 2 - 8;
    const bh = h / 2 - 6;
    return {
      frame: (
        <>
          <line x1={0} y1={-hh} x2={0} y2={-bh} {...STROKE} />
          <rect
            x={-bw}
            y={-bh}
            width={bw * 2}
            height={bh * 2}
            rx={4}
            {...FILLED}
          />
          <line x1={-bw} y1={-bh / 2} x2={-bw - 6} y2={-bh / 2} {...STROKE} />
          <line x1={-bw} y1={bh / 2} x2={-bw - 6} y2={bh / 2} {...STROKE} />
          <line x1={bw} y1={-bh / 2} x2={bw + 6} y2={-bh / 2} {...STROKE} />
          <line x1={bw} y1={bh / 2} x2={bw + 6} y2={bh / 2} {...STROKE} />
        </>
      ),
      icon: null,
    };
  },

  input_port: ({ w, h }) => ioPort(w, h, "in"),
  output_port: ({ w, h }) => ioPort(w, h, "out"),
  bidir_port: ({ w, h }) => ioPort(w, h, "both"),

  // Room-temperature bench instruments ----------------------------

  signal_generator: ({ w, h }) => {
    const hw = w / 2;
    const r = Math.min(w, h) / 2 - 8;
    return {
      frame: (
        <>
          <line x1={r} y1={0} x2={hw} y2={0} {...STROKE} />
          <circle cx={0} cy={0} r={r} {...FILLED} />
        </>
      ),
      // A single sine period — the source waveform, kept upright.
      icon: (
        <path
          d={`M ${-r * 0.55} 0 Q ${-r * 0.27} ${-r * 0.6} 0 0 T ${r * 0.55} 0`}
          {...STROKE}
        />
      ),
    };
  },

  awg: ({ w, h }) => {
    const hw = w / 2;
    const bw = w / 2 - 6;
    return {
      frame: (
        <>
          <line x1={bw} y1={0} x2={hw} y2={0} {...STROKE} />
          {instrumentBox(w, h)}
        </>
      ),
      icon: <GlyphLabel text="AWG" />,
    };
  },

  vna: ({ w, h }) => {
    const hw = w / 2;
    const bw = w / 2 - 6;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-bw} y2={0} {...STROKE} />
          {instrumentBox(w, h)}
        </>
      ),
      icon: <GlyphLabel text="VNA" />,
    };
  },

  digitizer: ({ w, h }) => {
    const hw = w / 2;
    const bw = w / 2 - 6;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-bw} y2={0} {...STROKE} />
          {instrumentBox(w, h)}
        </>
      ),
      icon: <GlyphLabel text="DIG" />,
    };
  },

  dio_module: ({ w, h }) => {
    const hw = w / 2;
    const bw = w / 2 - 6;
    return {
      frame: (
        <>
          <line x1={bw} y1={0} x2={hw} y2={0} {...STROKE} />
          {instrumentBox(w, h)}
        </>
      ),
      icon: <GlyphLabel text="DIO" />,
    };
  },

  mixer: ({ w, h }) => {
    const hw = w / 2;
    const hh = h / 2;
    const r = Math.min(w, h) / 2 - 8;
    const d = r * 0.6;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-r} y2={0} {...STROKE} />
          <line x1={r} y1={0} x2={hw} y2={0} {...STROKE} />
          <line x1={0} y1={r} x2={0} y2={hh} {...STROKE} />
          <circle cx={0} cy={0} r={r} {...FILLED} />
          <line x1={-d} y1={-d} x2={d} y2={d} {...STROKE} />
          <line x1={-d} y1={d} x2={d} y2={-d} {...STROKE} />
        </>
      ),
      icon: null,
    };
  },

  rf_switch: ({ w, h }) => {
    const hw = w / 2;
    const hh = h / 2;
    const bw = w / 2 - 6;
    const bh = h / 2 - 6;
    const y0 = portY(0, 2, h);
    const y1 = portY(1, 2, h);
    const pivotX = -bw + 8;
    return {
      frame: (
        <>
          <rect
            x={-bw}
            y={-bh}
            width={bw * 2}
            height={bh * 2}
            rx={4}
            {...FILLED}
          />
          <line x1={-hw} y1={0} x2={-bw} y2={0} {...STROKE} />
          <line x1={bw} y1={y0} x2={hw} y2={y0} {...STROKE} />
          <line x1={bw} y1={y1} x2={hw} y2={y1} {...STROKE} />
          <line x1={0} y1={bh} x2={0} y2={hh} {...STROKE} />
          {/* SPDT: common pivot, arm thrown to the upper contact. */}
          <circle cx={pivotX} cy={0} r={2.5} fill="#1a1d27" stroke="none" />
          <line x1={pivotX} y1={0} x2={bw - 6} y2={y0} {...STROKE} />
          <circle cx={bw - 6} cy={y1} r={2.5} {...FILLED} />
        </>
      ),
      icon: null,
    };
  },

  power_combiner: ({ w, h }) => {
    const hw = w / 2;
    const bw = Math.min(w, h) / 2 - 10;
    const bh = Math.min(w, h) / 2 - 8;
    const y0 = portY(0, 2, h);
    const y1 = portY(1, 2, h);
    // Two inputs merge into the triangle; one output leaves the apex.
    return {
      frame: (
        <>
          <line x1={-hw} y1={y0} x2={-bw} y2={y0} {...STROKE} />
          <line x1={-hw} y1={y1} x2={-bw} y2={y1} {...STROKE} />
          <path d={`M ${-bw} ${-bh} L ${bw} 0 L ${-bw} ${bh} Z`} {...FILLED} />
          <line x1={bw} y1={0} x2={hw} y2={0} {...STROKE} />
        </>
      ),
      icon: null,
    };
  },

  bias_tee: ({ w, h }) => {
    const hw = w / 2;
    const hh = h / 2;
    const capX = -w * 0.16;
    return {
      frame: (
        <>
          {/* RF path with a series capacitor. */}
          <line x1={-hw} y1={0} x2={capX - 3} y2={0} {...STROKE} />
          <line x1={capX - 3} y1={-8} x2={capX - 3} y2={8} {...STROKE} />
          <line x1={capX + 3} y1={-8} x2={capX + 3} y2={8} {...STROKE} />
          <line x1={capX + 3} y1={0} x2={hw} y2={0} {...STROKE} />
          {/* DC arm down through an inductor. */}
          <circle cx={0} cy={0} r={2} fill="#1a1d27" stroke="none" />
          <path d={`M 0 6 q 7 6 0 12 q -7 6 0 12`} {...STROKE} />
          <line x1={0} y1={hh - 6} x2={0} y2={hh} {...STROKE} />
        </>
      ),
      icon: null,
    };
  },

  termination: ({ w }) => {
    const hw = w / 2;
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-14} y2={0} {...STROKE} />
          <rect x={-14} y={-7} width={18} height={14} {...FILLED} />
          <line x1={4} y1={0} x2={12} y2={0} {...STROKE} />
          {/* Ground. */}
          <line x1={12} y1={-8} x2={12} y2={8} {...STROKE} />
          <line x1={16} y1={-5} x2={16} y2={5} {...STROKE} />
          <line x1={20} y1={-2.5} x2={20} y2={2.5} {...STROKE} />
        </>
      ),
      icon: (
        <text
          x={-5}
          y={0}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontWeight={700}
          fill="#1a1d27"
          stroke="none"
        >
          Ω
        </text>
      ),
    };
  },

  fridge_port: ({ w, h }, ctx) => {
    const hw = w / 2;
    const bw = w / 2 - 6;
    const bh = h / 2 - 6;
    const line = ctx?.linkedLineName?.trim();
    // A tag pointing right — the boundary into the fridge.
    return {
      frame: (
        <>
          <line x1={-hw} y1={0} x2={-bw} y2={0} {...STROKE} />
          <path
            d={`M ${-bw} ${-bh} L ${bw - 10} ${-bh} L ${bw} 0 L ${bw - 10} ${bh} L ${-bw} ${bh} Z`}
            {...FILLED}
          />
        </>
      ),
      // The linked fridge line's name; unlinked, a snowflake hinting "cold side".
      icon: line ? (
        <GlyphLabel text={line} />
      ) : (
        <g stroke="#1a1d27" strokeWidth={1.6} strokeLinecap="round">
          <line x1={-6} y1={0} x2={6} y2={0} />
          <line x1={-6} y1={0} x2={6} y2={0} transform="rotate(60)" />
          <line x1={-6} y1={0} x2={6} y2={0} transform="rotate(120)" />
        </g>
      ),
    };
  },
};
