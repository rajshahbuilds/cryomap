"use client";

import { useState } from "react";
import Link from "next/link";
import { WireSegment } from "./WireSegment";
import {
  WIRE_CONSTRUCTIONS,
  WIRE_CONSTRUCTION_META,
  type WireConstruction,
} from "@/lib/diagram/wireAppearance";

const ROUTES = {
  straight: {
    label: "Straight",
    path: "M 24 40 L 696 40",
    from: { x: 24, y: 40 },
    to: { x: 696, y: 40 },
  },
  bends: {
    label: "Bends",
    path: "M 24 24 L 224 24 L 224 58 L 496 58 L 496 24 L 696 24",
    from: { x: 24, y: 24 },
    to: { x: 696, y: 24 },
  },
  crossings: {
    label: "Crossings",
    path: "M 24 40 L 234 40 A 6 6 0 0 1 246 40 L 474 40 A 6 6 0 0 1 486 40 L 696 40",
    from: { x: 24, y: 40 },
    to: { x: 696, y: 40 },
  },
};

/** Development-only study using the same renderer as saved diagrams. */
export function WireAppearancePreview() {
  const [route, setRoute] = useState<keyof typeof ROUTES>("straight");
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<WireConstruction | null>(null);
  const geometry = ROUTES[route];
  return (
    <div className="h-full overflow-auto bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-7 sm:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
              Wire appearance prototype
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              One construction. One recognizable pattern.
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Compare wires on straight runs, bends, and crossings. Click a wire
              to inspect its selection highlight.
            </p>
          </div>
          <Link
            href="/playground"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            Back to editor
          </Link>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div
            className="inline-flex gap-1 rounded-lg border border-border bg-surface p-1"
            aria-label="Route shape"
          >
            {Object.entries(ROUTES).map(([key, value]) => (
              <button
                key={key}
                type="button"
                aria-pressed={route === key}
                onClick={() => setRoute(key as keyof typeof ROUTES)}
                className={`rounded-md px-3 py-1.5 text-sm ${route === key ? "bg-foreground text-white" : "text-muted hover:bg-background"}`}
              >
                {value.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-muted underline underline-offset-4"
              >
                Clear selection
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-muted">
              Zoom
              <select
                aria-label="Preview zoom"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-foreground"
              >
                {[0.5, 0.75, 1, 1.5, 2].map((value) => (
                  <option key={value} value={value}>
                    {value * 100}%
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 border-b border-border bg-background px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted sm:grid-cols-[12rem_minmax(0,1fr)] sm:px-5">
            <span>Construction</span>
            <span>
              {geometry.label} · {zoom * 100}%
            </span>
          </div>
          {WIRE_CONSTRUCTIONS.map((construction, index) => (
            <div
              key={construction}
              data-testid={`construction-${construction}`}
              className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-4 border-b border-border px-4 last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:px-5"
            >
              <button
                type="button"
                aria-label={`Select ${WIRE_CONSTRUCTION_META[construction].label}`}
                aria-pressed={selected === construction}
                onClick={() =>
                  setSelected(selected === construction ? null : construction)
                }
                className="flex items-center gap-3 py-5 text-left text-sm font-medium"
              >
                <span className="text-xs tabular-nums text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{WIRE_CONSTRUCTION_META[construction].label}</span>
              </button>
              <div className="overflow-x-auto py-1">
                <svg
                  role="img"
                  aria-label={`${WIRE_CONSTRUCTION_META[construction].label}, ${geometry.label.toLowerCase()} route`}
                  width={720 * zoom}
                  height={80 * zoom}
                  viewBox="0 0 720 80"
                  className="block max-w-none"
                >
                  {route === "crossings" ? (
                    <g stroke="#a1a1aa" strokeWidth={2}>
                      <path d="M 240 12 V 68" />
                      <path d="M 480 12 V 68" />
                    </g>
                  ) : null}
                  <WireSegment
                    {...geometry}
                    construction={construction}
                    selected={selected === construction}
                    onSelect={() =>
                      setSelected(
                        selected === construction ? null : construction,
                      )
                    }
                  />
                  <g fill="white" stroke="#a1a1aa" strokeWidth={1.3}>
                    <circle cx={geometry.from.x} cy={geometry.from.y} r={3} />
                    <circle cx={geometry.to.x} cy={geometry.to.y} r={3} />
                  </g>
                </svg>
              </div>
            </div>
          ))}
        </div>
        <p aria-live="polite" className="mt-4 min-h-5 text-sm text-muted">
          {selected
            ? `${WIRE_CONSTRUCTION_META[selected].label}: ${WIRE_CONSTRUCTION_META[selected].description}`
            : "Labels on this comparison identify constructions; wire labels remain hidden by default."}
        </p>
      </div>
    </div>
  );
}
