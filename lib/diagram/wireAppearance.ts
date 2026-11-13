import type { Point } from "./camera";

export const WIRE_CONSTRUCTIONS = [
  "unspecified",
  "single",
  "parallel_pair",
  "twisted_pair",
  "two_twisted_pairs",
  "ribbon",
  "multicore",
  "coaxial",
  "triaxial",
  "custom",
] as const;
export type WireConstruction = (typeof WIRE_CONSTRUCTIONS)[number];

export const WIRE_CONSTRUCTION_META: Record<
  WireConstruction,
  { label: string; description: string; width: number }
> = {
  unspecified: {
    width: 2,
    label: "Unspecified",
    description: "The existing plain wire appearance.",
  },
  single: {
    width: 6,
    label: "Single wire",
    description: "One conductor with sparse identification ticks.",
  },
  parallel_pair: {
    width: 5.7,
    label: "Parallel pair",
    description: "Two parallel conductors.",
  },
  twisted_pair: {
    width: 6.5,
    label: "Twisted pair",
    description: "Two alternating strands.",
  },
  two_twisted_pairs: {
    width: 8.6,
    label: "Two twisted pairs",
    description: "Four strands arranged as two twisting pairs.",
  },
  ribbon: {
    width: 10,
    label: "Ribbon cable",
    description: "Parallel conductors inside a flat sleeve.",
  },
  multicore: {
    width: 8,
    label: "Multicore cable",
    description: "A cable sleeve with recurring bundle marks.",
  },
  coaxial: {
    width: 7,
    label: "Coaxial",
    description: "A center conductor inside one sleeve.",
  },
  triaxial: {
    width: 10,
    label: "Triaxial",
    description: "A center conductor inside two sleeves.",
  },
  custom: {
    width: 6,
    label: "Custom",
    description: "A continuous wire with recurring ring markers.",
  },
};

export interface WireStroke {
  d: string;
  width: number;
  background?: boolean;
  dash?: string;
  fill?: boolean;
}
export interface WireAppearance {
  strokes: WireStroke[];
  width: number;
}
interface Section {
  length: number;
  at: (t: number) => Point;
}
export interface WireSample extends Point {
  distance: number;
}

/**
 * Sample the absolute/relative M/L/H/V and circular A commands used by the
 * router, including crossing hops. Unknown geometry returns null, so callers
 * can preserve the supplied SVG path instead of guessing its route.
 */
export function sampleWirePath(path: string): WireSample[] | null {
  const tokens =
    path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  if (!tokens.length || tokens.length > 20000) return null;
  const sections: Section[] = [];
  let cursor = 0;
  let command = "";
  let current: Point = { x: 0, y: 0 };
  let started = false;
  const number = () => {
    const token = tokens[cursor++];
    if (token == null || !Number.isFinite(Number(token)))
      throw new Error("Invalid path");
    return Number(token);
  };
  const line = (end: Point) => {
    const start = current;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length)
      sections.push({
        length,
        at: (t) => ({
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        }),
      });
    current = end;
  };
  try {
    while (cursor < tokens.length) {
      if (/^[a-zA-Z]$/.test(tokens[cursor])) command = tokens[cursor++];
      const relative = command === command.toLowerCase();
      const kind = command.toUpperCase();
      if (!started && kind !== "M") return null;
      const point = () => ({
        x: number() + (relative ? current.x : 0),
        y: number() + (relative ? current.y : 0),
      });
      if (kind === "M") {
        if (started) return null; // Disconnected subpaths must not be joined.
        current = point();
        started = true;
        command = relative ? "l" : "L";
      } else if (kind === "L") line(point());
      else if (kind === "H")
        line({ x: number() + (relative ? current.x : 0), y: current.y });
      else if (kind === "V")
        line({ x: current.x, y: number() + (relative ? current.y : 0) });
      else if (kind === "A") {
        const rx = Math.abs(number());
        const ry = Math.abs(number());
        number(); // Circle rotation does not change its geometry.
        const large = number();
        const sweep = number();
        const end = point();
        if (rx !== ry || ![0, 1].includes(large) || ![0, 1].includes(sweep))
          return null;
        const start = current;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const chord = Math.hypot(dx, dy);
        if (!rx || !chord) {
          line(end);
          continue;
        }
        const radius = Math.max(rx, chord / 2);
        const height = Math.sqrt(
          Math.max(0, radius * radius - (chord * chord) / 4),
        );
        const sign = large === sweep ? -1 : 1;
        const cx = (start.x + end.x) / 2 - (sign * height * dy) / chord;
        const cy = (start.y + end.y) / 2 + (sign * height * dx) / chord;
        const angle = Math.atan2(start.y - cy, start.x - cx);
        let delta = Math.atan2(end.y - cy, end.x - cx) - angle;
        if (sweep && delta < 0) delta += 2 * Math.PI;
        if (!sweep && delta > 0) delta -= 2 * Math.PI;
        sections.push({
          length: Math.abs(delta) * radius,
          at: (t) =>
            t === 1
              ? end
              : {
                  x: cx + radius * Math.cos(angle + delta * t),
                  y: cy + radius * Math.sin(angle + delta * t),
                },
        });
        current = end;
      } else return null;
    }
  } catch {
    return null;
  }
  const total = sections.reduce((sum, section) => sum + section.length, 0);
  if (!total) return [];
  const step = Math.max(2, total / 1600);
  const result: WireSample[] = [{ ...sections[0].at(0), distance: 0 }];
  let distance = 0;
  for (const section of sections) {
    const count = Math.ceil(section.length / step);
    for (let i = 1; i <= count; i++)
      result.push({
        ...section.at(i / count),
        distance: distance + (section.length * i) / count,
      });
    distance += section.length;
  }
  return result;
}

const coordinate = (n: number) => Number(n.toFixed(3));
const move = (p: Point) => `${coordinate(p.x)} ${coordinate(p.y)}`;

/** Miter normal at a corner; cap reversals rather than creating huge spikes. */
function normal(samples: WireSample[], i: number): Point {
  const p = samples[i];
  const before = samples[Math.max(0, i - 1)];
  const after = samples[Math.min(samples.length - 1, i + 1)];
  const unit = (a: Point, b: Point) => {
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  };
  if (i === 0) return unit(p, after);
  if (i === samples.length - 1) return unit(before, p);
  const a = unit(before, p);
  const b = unit(p, after);
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const denominator = m.x * b.x + m.y * b.y;
  return denominator < 0.25
    ? b
    : { x: m.x / denominator, y: m.y / denominator };
}

function strand(
  samples: WireSample[],
  offset: (distance: number) => number,
): string {
  const total = samples.at(-1)!.distance;
  return samples
    .map((p, i) => {
      // All strands terminate at the actual component port.
      const taper = Math.min(1, p.distance / 10, (total - p.distance) / 10);
      const n = normal(samples, i);
      const amount = offset(p.distance) * taper;
      return `${i ? "L" : "M"} ${move({ x: p.x + n.x * amount, y: p.y + n.y * amount })}`;
    })
    .join(" ");
}

/** Pure SVG geometry: no DOM measurements, so previews and exports agree. */
export function wireAppearance(
  path: string,
  construction: WireConstruction = "unspecified",
): WireAppearance {
  const stroke = (
    width: number,
    background = false,
    dash?: string,
  ): WireStroke => ({ d: path, width, background, dash });
  const original = { strokes: [stroke(2)], width: 2 };
  if (construction === "unspecified") return original;
  if (construction === "coaxial")
    return { strokes: [stroke(7), stroke(4.8, true), stroke(1.2)], width: 7 };
  if (construction === "triaxial")
    return {
      strokes: [
        stroke(10),
        stroke(7.8, true),
        stroke(5.6),
        stroke(3.4, true),
        stroke(1),
      ],
      width: 10,
    };
  if (construction === "multicore")
    return {
      strokes: [stroke(8), stroke(5.6, true), stroke(2.6, false, "2 9")],
      width: 8,
    };
  const samples = sampleWirePath(path);
  if (!samples || samples.length < 2) return original;
  const strands = (offsets: ((s: number) => number)[], width = 1.3) =>
    offsets.map((offset) => ({ d: strand(samples, offset), width }));
  if (construction === "parallel_pair")
    return { strokes: strands([() => -2.2, () => 2.2]), width: 5.7 };
  if (construction === "twisted_pair")
    return {
      strokes: strands(
        [-1, 1].map((sign) => (s) => sign * 2.6 * Math.sin((s * Math.PI) / 12)),
      ),
      width: 6.5,
    };
  if (construction === "two_twisted_pairs")
    return {
      strokes: strands(
        [-2.5, 2.5].flatMap((center) =>
          [-1, 1].map(
            (sign) => (s) => center + sign * 1.3 * Math.sin((s * Math.PI) / 10),
          ),
        ),
        1,
      ),
      width: 8.6,
    };
  if (construction === "ribbon")
    return {
      strokes: [
        stroke(10),
        stroke(8, true),
        ...strands(
          [-3, -1, 1, 3].map((n) => () => n),
          0.8,
        ),
      ],
      width: 10,
    };
  const total = samples.at(-1)!.distance;
  const marks: string[] = [];
  for (
    let distance = Math.min(32, total / 2);
    distance < total - Math.min(16, total / 4);
    distance += 64
  ) {
    const i = samples.findIndex((p) => p.distance >= distance);
    const p = samples[i];
    const n = normal(samples, i);
    if (construction === "single")
      marks.push(
        `M ${move({ x: p.x - n.x * 2.3, y: p.y - n.y * 2.3 })} L ${move({ x: p.x + n.x * 2.3, y: p.y + n.y * 2.3 })}`,
      );
    else
      marks.push(
        `M ${move({ x: p.x - 2.5, y: p.y })} a 2.5 2.5 0 1 0 5 0 a 2.5 2.5 0 1 0 -5 0`,
      );
  }
  return {
    strokes: [
      stroke(2),
      ...(marks.length
        ? [{ d: marks.join(" "), width: 1.2, fill: construction === "custom" }]
        : []),
    ],
    width: 6,
  };
}
