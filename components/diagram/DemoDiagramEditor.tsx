"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  BuiltInComponentType,
  Component,
  DiagramState,
  Line,
  LineType,
  Rotation,
  Stage,
} from "@/lib/types";
import type { Point } from "@/lib/diagram/camera";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { diagramBounds } from "@/lib/diagram/bounds";
import {
  componentBox,
  resolvePlacement,
  targetToPosition,
  type Box,
  type ResolvedPlacement,
} from "@/lib/diagram/placement";
import {
  componentSize,
  effectiveRotation,
} from "@/lib/diagram/componentGeometry";
import { COMPONENT_LIBRARY } from "@/lib/constants/componentLibrary";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { zoomPercent } from "@/lib/diagram/status";
import { Canvas } from "./Canvas";
import { ComponentCaption, ComponentSymbol } from "./ComponentSymbol";
import { ComponentPalette, type PaletteSelection } from "./ComponentPalette";
import { LineColumns } from "./LineColumns";
import { LinesBar } from "./LinesBar";
import { StagesBands } from "./StagesBands";
import { StagesBar } from "./StagesBar";
import { WireJunctions, WireSegments } from "./WireSegment";

const DEMO_FRIDGE_ID = "demo-fridge";
const DEMO_SHEET_ID = "demo-sheet";
const CREATED_AT = "2026-01-01T00:00:00.000Z";
const STAGE_PRESETS = [
  ["50 K", "50 K"],
  ["4 K", "4 K"],
  ["Still", "800 mK"],
  ["Cold plate", "100 mK"],
  ["Mixing chamber", "10 mK"],
] as const;

function emptyDemoState(): DiagramState {
  return {
    sheets: [
      {
        id: DEMO_SHEET_ID,
        fridge_id: DEMO_FRIDGE_ID,
        kind: "fridge",
        name: "Fridge wiring",
        sort_order: 0,
        notes: null,
        created_at: CREATED_AT,
      },
    ],
    stages: [],
    lines: [],
    components: [],
    customDefs: [],
    connections: [],
    annotations: [],
  };
}

function reorder<T extends { id: string; sort_order: number }>(
  rows: T[],
  id: string,
  direction: -1 | 1,
): T[] {
  const ordered = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  const index = ordered.findIndex((row) => row.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ordered.length) return rows;
  [ordered[index], ordered[next]] = [ordered[next], ordered[index]];
  return ordered.map((row, sort_order) => ({ ...row, sort_order }));
}

function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

export function DemoDiagramEditor() {
  const idCounter = useRef(0);
  const makeId = useCallback(
    (kind: string) => `demo-${kind}-${++idCounter.current}`,
    [],
  );
  const [state, setState] = useState<DiagramState>(emptyDemoState);
  const [placing, setPlacing] = useState<PaletteSelection | null>(null);
  const [ghost, setGhost] = useState<ResolvedPlacement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movePreview, setMovePreview] = useState<ResolvedPlacement | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const view = useMemo(() => assembleDiagram(state, DEMO_SHEET_ID), [state]);
  const bounds = useMemo(() => diagramBounds(view), [view]);

  const obstacles = useCallback(
    (excludeId?: string): Box[] =>
      view.positioned
        .filter(({ component }) => component.id !== excludeId)
        .map(({ component, x, y }) =>
          componentBox(
            { x, y },
            componentSize(component, null),
            effectiveRotation(component, view.orientation),
          ),
        ),
    [view],
  );

  const resolveFor = useCallback(
    (point: Point, type: BuiltInComponentType, excludeId?: string) =>
      resolvePlacement({
        point,
        size: COMPONENT_LIBRARY[type].defaultSize,
        rotation: 0,
        stages: view.stages,
        lines: view.lines,
        obstacles: obstacles(excludeId),
      }),
    [obstacles, view.lines, view.stages],
  );

  const handlePointerMove = useCallback(
    (point: Point) => {
      if (placing?.kind === "builtin") {
        setGhost(resolveFor(point, placing.type));
        return;
      }
      if (!draggingId) return;
      const component = state.components.find((item) => item.id === draggingId);
      if (component && component.component_type !== "custom") {
        setMovePreview(
          resolveFor(point, component.component_type, component.id),
        );
      }
    },
    [draggingId, placing, resolveFor, state.components],
  );

  const addComponent = useCallback(
    (type: BuiltInComponentType, placement: ResolvedPlacement) => {
      if (!placement.target) return;
      const defaults = COMPONENT_LIBRARY[type].defaultFields;
      const component: Component = {
        id: makeId("component"),
        fridge_id: null,
        sheet_id: DEMO_SHEET_ID,
        component_type: type,
        custom_def_id: null,
        linked_line_id: null,
        label: defaults.label ?? null,
        value: defaults.value ?? null,
        manufacturer: null,
        part_number: null,
        serial_number: null,
        frequency_range: null,
        power_rating: null,
        datasheet_url: null,
        notes: null,
        extra_fields: {},
        x_offset: 0,
        rotation: 0,
        mirrored: false,
        ...targetToPosition(placement.target),
        last_edited_by: null,
        last_edited_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      setState((current) => ({
        ...current,
        components: [...current.components, component],
      }));
      setSelectedId(component.id);
    },
    [makeId],
  );

  const handlePointerUp = useCallback(
    (point: Point) => {
      if (placing?.kind === "builtin") {
        const placement = resolveFor(point, placing.type);
        if (placement.valid) addComponent(placing.type, placement);
        setPlacing(null);
        setGhost(null);
        return;
      }
      if (!draggingId) {
        setSelectedId(null);
        return;
      }
      const component = state.components.find((item) => item.id === draggingId);
      if (component && component.component_type !== "custom") {
        const placement = resolveFor(
          point,
          component.component_type,
          component.id,
        );
        if (placement.target) {
          const position = targetToPosition(placement.target);
          setState((current) => ({
            ...current,
            components: current.components.map((item) =>
              item.id === component.id ? { ...item, ...position } : item,
            ),
          }));
        }
      }
      setDraggingId(null);
      setMovePreview(null);
    },
    [addComponent, draggingId, placing, resolveFor, state.components],
  );

  const canvas = useCanvas({
    onLogicalPointerMove: handlePointerMove,
    onLogicalPointerUp: handlePointerUp,
  });

  useEffect(() => {
    if (!placing) return;
    const cancelPlacement = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPlacing(null);
      setGhost(null);
    };
    window.addEventListener("keydown", cancelPlacement);
    return () => window.removeEventListener("keydown", cancelPlacement);
  }, [placing]);

  const addStage = () => {
    const index = state.stages.length;
    const preset = STAGE_PRESETS[index] ?? [`Stage ${index + 1}`, ""];
    const stage: Stage = {
      id: makeId("stage"),
      fridge_id: null,
      sheet_id: DEMO_SHEET_ID,
      name: preset[0],
      nominal_temp: preset[1] || null,
      color: null,
      sort_order: index,
      height_px: 180,
      hidden: false,
      locked: false,
    };
    setState((current) => ({
      ...current,
      stages: [...current.stages, stage],
    }));
  };

  const addLine = () => {
    const index = state.lines.length;
    const line: Line = {
      id: makeId("line"),
      fridge_id: null,
      sheet_id: DEMO_SHEET_ID,
      name: `Line ${index + 1}`,
      line_type: null,
      direction: null,
      status: "planned",
      notes: null,
      sort_order: index,
      width_px: 120,
      show_label: true,
      created_at: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      lines: [...current.lines, line],
    }));
  };

  const patchStage = (id: string, patch: Partial<Stage>) =>
    setState((current) => ({
      ...current,
      stages: current.stages.map((stage) =>
        stage.id === id ? { ...stage, ...patch } : stage,
      ),
    }));

  const patchLine = (id: string, patch: Partial<Line>) =>
    setState((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.id === id ? { ...line, ...patch } : line,
      ),
    }));

  const deleteSelected = () => {
    if (!selectedId) return;
    setState((current) => ({
      ...current,
      components: current.components.filter((item) => item.id !== selectedId),
    }));
    setSelectedId(null);
  };

  const rotateSelected = () => {
    if (!selectedId) return;
    setState((current) => ({
      ...current,
      components: current.components.map((item) =>
        item.id === selectedId
          ? { ...item, rotation: nextRotation(item.rotation) }
          : item,
      ),
    }));
  };

  const reset = () => {
    if (
      state.components.length + state.lines.length + state.stages.length > 0 &&
      !window.confirm("Clear this temporary demo canvas?")
    ) {
      return;
    }
    setState(emptyDemoState());
    setPlacing(null);
    setGhost(null);
    setDraggingId(null);
    setMovePreview(null);
    setSelectedId(null);
    canvas.resetView();
  };

  const hasStructure = state.stages.length > 0 || state.lines.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="rounded-full bg-ice/10 px-2.5 py-1 text-xs font-semibold text-ice-deep">
          Demo mode
        </span>
        <span className="text-xs text-muted">
          Refreshing or leaving clears the canvas.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {selectedId ? (
            <>
              <button
                type="button"
                onClick={rotateSelected}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-background"
              >
                Rotate
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-status-broken hover:bg-background"
              >
                Delete
              </button>
            </>
          ) : null}
          <div className="flex items-center overflow-hidden rounded-md border border-border">
            <button
              type="button"
              aria-label="Zoom out"
              onClick={canvas.zoomOut}
              className="px-2 py-1 text-xs font-medium hover:bg-background"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Reset zoom"
              onClick={canvas.resetView}
              className="min-w-[3.25rem] border-x border-border px-1 py-1 text-xs font-medium tabular-nums hover:bg-background"
            >
              {zoomPercent(canvas.camera.scale)}%
            </button>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={canvas.zoomIn}
              className="px-2 py-1 text-xs font-medium hover:bg-background"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-background"
          >
            Reset canvas
          </button>
          <Link
            href="/?next=/fridges"
            className="rounded-md bg-foreground px-3 py-1 text-xs font-semibold text-surface transition hover:opacity-90"
          >
            Sign in to save
          </Link>
        </div>
      </div>

      <LinesBar
        lines={state.lines}
        onAdd={addLine}
        onRename={(id, name) => name && patchLine(id, { name })}
        onSetType={(id, line_type: LineType | null) =>
          patchLine(id, { line_type })
        }
        onToggleLabel={(id, show_label) => patchLine(id, { show_label })}
        onMove={(id, direction) =>
          setState((current) => ({
            ...current,
            lines: reorder(current.lines, id, direction === "left" ? -1 : 1),
          }))
        }
        onDelete={(id) => {
          setState((current) => ({
            ...current,
            lines: current.lines
              .filter((line) => line.id !== id)
              .map((line, sort_order) => ({ ...line, sort_order })),
            components: current.components.filter(
              (component) => component.line_id !== id,
            ),
          }));
          setSelectedId(null);
        }}
      />

      <StagesBar
        stages={state.stages}
        onAdd={addStage}
        onRename={(id, name) => name && patchStage(id, { name })}
        onSetTemp={(id, nominal_temp) =>
          patchStage(id, { nominal_temp: nominal_temp || null })
        }
        onSetColor={(id, color) => patchStage(id, { color })}
        onToggleHidden={(id, hidden) => patchStage(id, { hidden })}
        onMove={(id, direction) =>
          setState((current) => ({
            ...current,
            stages: reorder(current.stages, id, direction === "up" ? -1 : 1),
          }))
        }
        onDelete={(id) => {
          setState((current) => ({
            ...current,
            stages: current.stages
              .filter((stage) => stage.id !== id)
              .map((stage, sort_order) => ({ ...stage, sort_order })),
            components: current.components.filter(
              (component) => component.stage_id !== id,
            ),
          }));
          setSelectedId(null);
        }}
      />

      <div className="flex min-h-0 flex-1">
        <ComponentPalette
          customDefs={[]}
          onStartPlace={(selection) => {
            setPlacing(selection);
            setGhost(null);
          }}
        />
        <div className="relative min-w-0 flex-1 bg-background">
          <Canvas
            controller={canvas}
            width={bounds.width}
            height={bounds.height}
            background={
              <StagesBands stages={view.stages} width={bounds.width} />
            }
          >
            <LineColumns lines={view.lines} height={bounds.height} />
            <WireSegments wires={view.wires} />
            {view.positioned.map(({ component, x, y }) => {
              const moving = component.id === draggingId && movePreview?.valid;
              const drawX = moving ? movePreview.x : x;
              const drawY = moving ? movePreview.y : y;
              const size = componentSize(component, null);
              const box = componentBox(
                { x: drawX, y: drawY },
                size,
                effectiveRotation(component, view.orientation),
              );
              return (
                <g
                  key={component.id}
                  onPointerDown={(event: ReactPointerEvent<SVGGElement>) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    setDraggingId(component.id);
                    setSelectedId(component.id);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(component.id);
                  }}
                  className="cursor-move"
                >
                  {selectedId === component.id ? (
                    <rect
                      x={box.x - box.width / 2 - 7}
                      y={box.y - box.height / 2 - 7}
                      width={box.width + 14}
                      height={box.height + 14}
                      rx={8}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      pointerEvents="none"
                    />
                  ) : null}
                  <ComponentSymbol
                    component={component}
                    x={drawX}
                    y={drawY}
                    orientation={view.orientation}
                    showCaption={false}
                  />
                  <ComponentCaption component={component} x={drawX} y={drawY} />
                </g>
              );
            })}
            <WireJunctions points={view.junctions} />
            {placing?.kind === "builtin" && ghost ? (
              <g opacity={ghost.valid ? 0.7 : 0.3} pointerEvents="none">
                <ComponentSymbol
                  component={
                    {
                      component_type: placing.type,
                      custom_def_id: null,
                      rotation: 0,
                      mirrored: false,
                      label: null,
                      value:
                        COMPONENT_LIBRARY[placing.type].defaultFields.value ??
                        null,
                      linked_line_id: null,
                    } as Component
                  }
                  x={ghost.x}
                  y={ghost.y}
                  orientation={view.orientation}
                />
              </g>
            ) : null}
          </Canvas>

          {!hasStructure && state.components.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
              <div className="max-w-md rounded-xl border border-border bg-surface/95 px-5 py-4 shadow-sm">
                <p className="font-semibold text-foreground">
                  Build a quick fridge wiring diagram
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Add a temperature stage and a line above, then drag a
                  component from the palette onto the canvas.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-border bg-surface px-4 py-1 text-xs text-muted">
        <span>{state.components.length} components</span>
        <span aria-hidden="true" className="text-border">
          |
        </span>
        <span>
          Scroll or Space+drag to pan · pinch or ⌘/Ctrl+scroll to zoom
        </span>
        {placing ? (
          <span className="ml-auto font-medium text-status-planned">
            Click the canvas to place · Esc to cancel
          </span>
        ) : null}
      </div>
    </div>
  );
}
