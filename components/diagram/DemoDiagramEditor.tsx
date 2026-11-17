"use client";

import { DEFAULT_WIRE_PROPERTIES } from "@/lib/types";

import { LINE_ENDPOINT_HEADER } from "@/lib/diagram/lineConnections";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type {
  BuiltInComponentType,
  Component,
  CustomComponentDef,
  DiagramState,
  Line,
  LineType,
  Rotation,
  Stage,
} from "@/lib/types";
import type { Point, Size } from "@/lib/diagram/camera";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { diagramBounds } from "@/lib/diagram/bounds";
import { resizeStageHeight } from "@/lib/diagram/stageOps";
import {
  componentBox,
  resolvePlacement,
  targetToPosition,
  type Box,
  type ResolvedPlacement,
} from "@/lib/diagram/placement";
import {
  componentSize,
  baseRotationForType,
  effectiveRotation,
} from "@/lib/diagram/componentGeometry";
import { COMPONENT_LIBRARY } from "@/lib/constants/componentLibrary";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { zoomPercent } from "@/lib/diagram/status";
import { Canvas } from "./Canvas";
import { ComponentCaption, ComponentSymbol } from "./ComponentSymbol";
import { ComponentPalette, type PaletteSelection } from "./ComponentPalette";
import { CustomComponentModal } from "./CustomComponentModal";
import {
  customDefUsageCount,
  defToFormValues,
  type CustomDefFormValues,
} from "@/lib/diagram/customDef";
import { useToast } from "@/components/toast/ToastProvider";
import { LineColumns, LineEndpointCaption } from "./LineColumns";
import {
  connectionExists,
  findNearestPort,
  type PortAnchor,
} from "@/lib/diagram/connect";
import {
  withoutComponents,
  withoutConnection,
} from "@/lib/diagram/optimisticState";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { WirePropertiesPanel } from "./WirePropertiesPanel";
import { SignalMatches } from "./SignalMatches";
import { isSignalPort } from "@/lib/types/signalPorts";
import { LinesBar } from "./LinesBar";
import { PropertiesPanel } from "./PropertiesPanel";
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
    wireSegmentProperties: [],
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

/** Persist a virtual line terminal only when the demo user interacts with it. */
function withDemoComponent(
  state: DiagramState,
  component: Component,
  patch: Partial<Component> = {},
): DiagramState {
  const saved = state.components.find((item) => item.id === component.id);
  const updated = { ...(saved ?? component), ...patch };
  return {
    ...state,
    components: saved
      ? state.components.map((item) =>
          item.id === component.id ? updated : item,
        )
      : [...state.components, updated],
  };
}

function selectionFor(component: Component): PaletteSelection {
  return component.component_type === "custom"
    ? { kind: "custom", defId: component.custom_def_id ?? "" }
    : { kind: "builtin", type: component.component_type };
}

export function DemoDiagramEditor() {
  const toast = useToast();
  const [customModal, setCustomModal] = useState<
    { mode: "create" } | { mode: "edit"; def: CustomComponentDef } | null
  >(null);
  const idCounter = useRef(0);
  const makeId = useCallback(
    (kind: string) => `demo-${kind}-${++idCounter.current}`,
    [],
  );
  const [history, setHistory] = useState(() => ({
    past: [] as DiagramState[],
    present: emptyDemoState(),
    future: [] as DiagramState[],
  }));
  const state = history.present;
  const setState = useCallback((update: SetStateAction<DiagramState>) => {
    setHistory((history) => {
      const next =
        typeof update === "function" ? update(history.present) : update;
      return next === history.present
        ? history
        : {
            past: [...history.past.slice(-99), history.present],
            present: next,
            future: [],
          };
    });
  }, []);
  const [placing, setPlacing] = useState<PaletteSelection | null>(null);
  const [ghost, setGhost] = useState<ResolvedPlacement | null>(null);
  const dragStart = useRef<Point | null>(null);
  const resizing = useRef<{ stageId: string; bandTop: number } | null>(null);
  const [resizePreview, setResizePreview] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [movePreview, setMovePreview] = useState<ResolvedPlacement | null>(
    null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{
    from: PortAnchor;
    cursor: Point;
  } | null>(null);
  const connectingRef = useRef(connecting);
  const setConnection = (value: typeof connecting) => {
    connectingRef.current = value;
    setConnecting(value);
  };

  const view = useMemo(() => assembleDiagram(state, DEMO_SHEET_ID), [state]);
  const bounds = useMemo(() => diagramBounds(view), [view]);
  const selectedComponent = view.positioned.find(
    ({ component }) => component.id === selectedId,
  )?.component;
  const selectedDef = selectedComponent?.custom_def_id
    ? view.customDefById.get(selectedComponent.custom_def_id)
    : undefined;
  const selectedWire = state.connections.find(
    (wire) => wire.id === selectedWireId,
  );

  const obstacles = useCallback(
    (excludeId?: string): Box[] =>
      view.positioned
        .filter(({ component }) => component.id !== excludeId)
        .map(({ component, x, y }) =>
          componentBox(
            { x, y },
            componentSize(
              component,
              component.custom_def_id
                ? view.customDefById.get(component.custom_def_id)
                : null,
            ),
            effectiveRotation(component, view.orientation),
          ),
        ),
    [view],
  );

  const resolveFor = useCallback(
    (point: Point, selection: PaletteSelection, excludeId?: string) => {
      const component = view.positioned.find(
        (p) => p.component.id === excludeId,
      )?.component;
      let size: Size;
      if (selection.kind === "builtin") {
        size = COMPONENT_LIBRARY[selection.type].defaultSize;
      } else {
        const def = view.customDefById.get(selection.defId);
        if (!def) return { ...point, valid: false, target: null };
        size = { width: def.width_px, height: def.height_px };
      }
      return resolvePlacement({
        point,
        size,
        rotation: component
          ? effectiveRotation(component, view.orientation)
          : selection.kind === "builtin"
            ? baseRotationForType(selection.type, view.orientation)
            : 0,
        stages: component?.line_endpoint_id ? [] : view.stages,
        lines: component?.line_endpoint_id ? [] : view.lines,
        obstacles: obstacles(excludeId),
      });
    },
    [obstacles, view],
  );

  const handlePointerMove = useCallback(
    (point: Point) => {
      if (resizing.current) {
        const { bandTop } = resizing.current;
        setResizePreview(bandTop + resizeStageHeight(bandTop, point.y));
        return;
      }
      if (connectingRef.current) {
        const next = { ...connectingRef.current, cursor: point };
        connectingRef.current = next;
        setConnecting(next);
        return;
      }
      if (placing) {
        setGhost(resolveFor(point, placing));
        return;
      }
      if (!draggingId) return;
      if (
        dragStart.current &&
        Math.hypot(
          point.x - dragStart.current.x,
          point.y - dragStart.current.y,
        ) < 3
      )
        return;
      const component = view.positioned.find(
        ({ component }) => component.id === draggingId,
      )?.component;
      if (component) {
        setMovePreview(
          resolveFor(point, selectionFor(component), component.id),
        );
      }
    },
    [draggingId, placing, resolveFor, view.positioned],
  );

  const addComponent = useCallback(
    (selection: PaletteSelection, placement: ResolvedPlacement) => {
      if (!placement.target) return;
      const defaults =
        selection.kind === "builtin"
          ? COMPONENT_LIBRARY[selection.type].defaultFields
          : {};
      const component: Component = {
        id: makeId("component"),
        fridge_id: DEMO_FRIDGE_ID,
        sheet_id: DEMO_SHEET_ID,
        component_type:
          selection.kind === "builtin" ? selection.type : "custom",
        custom_def_id: selection.kind === "custom" ? selection.defId : null,
        linked_line_id: null,
        line_endpoint_id: null,
        line_entry_port: null,
        line_exit_port: null,
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
      setSelectedWireId(null);
    },
    [makeId, setState],
  );

  const handlePointerUp = useCallback(
    (point: Point) => {
      if (resizing.current) {
        const { stageId, bandTop } = resizing.current;
        resizing.current = null;
        setResizePreview(null);
        const height = resizeStageHeight(bandTop, point.y);
        setState((current) => {
          const stage = current.stages.find((stage) => stage.id === stageId);
          if (!stage || stage.height_px === height) return current;
          return {
            ...current,
            stages: current.stages.map((stage) =>
              stage.id === stageId ? { ...stage, height_px: height } : stage,
            ),
          };
        });
        return;
      }
      const pending = connectingRef.current;
      if (pending) {
        connectingRef.current = null;
        setConnecting(null);
        const target = findNearestPort(
          view.portAnchors,
          point,
          undefined,
          pending.from.componentId,
        );
        if (target) {
          const fromComponent = view.positioned.find(
            (p) => p.component.id === pending.from.componentId,
          )?.component;
          const toComponent = view.positioned.find(
            (p) => p.component.id === target.componentId,
          )?.component;
          const id = makeId("wire");
          if (fromComponent && toComponent)
            setState((current) => {
              if (connectionExists(current.connections, pending.from, target))
                return current;
              const materialized = withDemoComponent(
                withDemoComponent(current, fromComponent),
                toComponent,
              );
              return {
                ...materialized,
                connections: [
                  ...materialized.connections,
                  {
                    id,
                    fridge_id: DEMO_FRIDGE_ID,
                    sheet_id: DEMO_SHEET_ID,
                    from_component_id: pending.from.componentId,
                    from_port_side: pending.from.port.side,
                    from_port_index: pending.from.port.index,
                    to_component_id: target.componentId,
                    to_port_side: target.port.side,
                    to_port_index: target.port.index,
                    wire_properties: { ...DEFAULT_WIRE_PROPERTIES },
                    created_at: new Date().toISOString(),
                  },
                ],
              };
            });
        }
        return;
      }
      if (placing) {
        const placement = resolveFor(point, placing);
        if (placement.valid) addComponent(placing, placement);
        setPlacing(null);
        setGhost(null);
        return;
      }
      if (!draggingId) {
        setSelectedId(null);
        setSelectedWireId(null);
        return;
      }
      if (
        dragStart.current &&
        Math.hypot(
          point.x - dragStart.current.x,
          point.y - dragStart.current.y,
        ) < 3
      ) {
        setDraggingId(null);
        setMovePreview(null);
        dragStart.current = null;
        return;
      }
      dragStart.current = null;
      const component = view.positioned.find(
        ({ component }) => component.id === draggingId,
      )?.component;
      if (component) {
        const placement = resolveFor(
          point,
          selectionFor(component),
          component.id,
        );
        if (placement.target) {
          const position = targetToPosition(placement.target);
          setState((current) =>
            withDemoComponent(current, component, position),
          );
        }
      }
      setDraggingId(null);
      setMovePreview(null);
    },
    [addComponent, draggingId, placing, resolveFor, view, makeId, setState],
  );

  const canvas = useCanvas({
    topInset: view.lines.length ? LINE_ENDPOINT_HEADER : 0,
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

  const submitCustom = (values: CustomDefFormValues) => {
    if (!customModal) return;
    const modal = customModal;
    const id = modal.mode === "create" ? makeId("definition") : modal.def.id;
    setState((current) => ({
      ...current,
      customDefs:
        modal.mode === "create"
          ? [
              ...current.customDefs,
              {
                ...values,
                id,
                fridge_id: DEMO_FRIDGE_ID,
                created_by: null,
                created_at: new Date().toISOString(),
              },
            ]
          : current.customDefs.map((def) =>
              def.id === id ? { ...def, ...values } : def,
            ),
    }));
    setCustomModal(null);
  };

  const deleteCustom = (def: CustomComponentDef) => {
    const uses = customDefUsageCount(state.components, def.id);
    if (uses) {
      toast.warning(
        `Remove the ${uses} component${uses === 1 ? "" : "s"} using “${def.name}” before deleting its definition.`,
      );
      return;
    }
    setState((current) => ({
      ...current,
      customDefs: current.customDefs.filter((item) => item.id !== def.id),
    }));
    if (placing?.kind === "custom" && placing.defId === def.id) {
      setPlacing(null);
      setGhost(null);
    }
  };

  const addStage = () => {
    const index = state.stages.length;
    const preset = STAGE_PRESETS[index] ?? [`Stage ${index + 1}`, ""];
    const stage: Stage = {
      id: makeId("stage"),
      fridge_id: DEMO_FRIDGE_ID,
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
      fridge_id: DEMO_FRIDGE_ID,
      sheet_id: DEMO_SHEET_ID,
      name: `Line ${index + 1}`,
      line_type: null,
      direction: "input",
      entry_wire_properties: { ...DEFAULT_WIRE_PROPERTIES },
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

  const deleteWire = () => {
    if (selectedWireId)
      setState((current) => withoutConnection(current, selectedWireId));
    setSelectedWireId(null);
  };
  const deleteSelected = () => {
    if (selectedWireId) {
      deleteWire();
      return;
    }
    if (!selectedComponent || selectedComponent.line_endpoint_id) return;
    setState((current) => withoutComponents(current, [selectedComponent.id]));
    setSelectedId(null);
  };
  const patchSelected = (patch: Partial<Component>) => {
    if (selectedComponent)
      setState((current) =>
        withDemoComponent(current, selectedComponent, patch),
      );
  };
  const rotateSelected = () =>
    selectedComponent &&
    patchSelected({ rotation: nextRotation(selectedComponent.rotation) });
  const mirrorSelected = () =>
    selectedComponent &&
    patchSelected({ mirrored: !selectedComponent.mirrored });
  const saveSelectedMetadata = (patch: Record<string, unknown>) => {
    if (!selectedComponent) return;
    const lineId = selectedComponent.line_endpoint_id;
    if (lineId && "line_endpoint_direction" in patch) {
      const direction = patch.line_endpoint_direction;
      if (
        direction === "input" ||
        direction === "output" ||
        direction === "bidirectional"
      )
        patchLine(lineId, { direction });
      return;
    }
    setState((current) => {
      const updated = withDemoComponent(current, selectedComponent, {
        ...patch,
        last_edited_at: new Date().toISOString(),
      });
      const name = typeof patch.label === "string" ? patch.label.trim() : "";
      return lineId && name
        ? {
            ...updated,
            lines: updated.lines.map((line) =>
              line.id === lineId ? { ...line, name } : line,
            ),
          }
        : updated;
    });
  };
  const deselect = () => {
    resizing.current = null;
    setResizePreview(null);
    dragStart.current = null;
    setSelectedId(null);
    setSelectedWireId(null);
    setConnection(null);
    setDraggingId(null);
    setMovePreview(null);
    setPlacing(null);
    setGhost(null);
  };
  const undo = () => {
    deselect();
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
  };
  const redo = () => {
    deselect();
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
  };
  useKeyboardShortcuts(
    {
      delete: deleteSelected,
      deselect,
      rotate: rotateSelected,
      mirror: mirrorSelected,
      undo,
      redo,
    },
    !customModal,
  );

  const reset = () => {
    if (
      state.components.length +
        state.lines.length +
        state.stages.length +
        state.customDefs.length >
        0 &&
      !window.confirm("Clear this temporary demo canvas?")
    ) {
      return;
    }
    setState(emptyDemoState());
    setCustomModal(null);
    setPlacing(null);
    setGhost(null);
    setDraggingId(null);
    setMovePreview(null);
    deselect();
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
          <button
            type="button"
            onClick={undo}
            disabled={!history.past.length}
            className="rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!history.future.length}
            className="rounded-md border border-border px-2.5 py-1 text-xs disabled:opacity-40"
          >
            Redo
          </button>
          {selectedId ? (
            <>
              <button
                type="button"
                onClick={rotateSelected}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-background"
              >
                Rotate
              </button>
              {!selectedComponent?.line_endpoint_id ? (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-status-broken hover:bg-background"
                >
                  Delete
                </button>
              ) : null}
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
            ...withoutComponents(
              current,
              current.components
                .filter(
                  (component) =>
                    component.line_id === id ||
                    component.line_endpoint_id === id,
                )
                .map((component) => component.id),
            ),
            lines: current.lines
              .filter((line) => line.id !== id)
              .map((line, sort_order) => ({ ...line, sort_order })),
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
            ...withoutComponents(
              current,
              current.components
                .filter((component) => component.stage_id === id)
                .map((component) => component.id),
            ),
            stages: current.stages
              .filter((stage) => stage.id !== id)
              .map((stage, sort_order) => ({ ...stage, sort_order })),
          }));
          setSelectedId(null);
        }}
      />

      <div className="flex min-h-0 flex-1">
        <ComponentPalette
          customDefs={state.customDefs}
          onCreateCustom={() => {
            deselect();
            setCustomModal({ mode: "create" });
          }}
          onEditCustom={(def) => {
            deselect();
            setCustomModal({ mode: "edit", def });
          }}
          onDeleteCustom={deleteCustom}
          onStartPlace={(selection) => {
            setPlacing(selection);
            setGhost(null);
          }}
        />
        <div className="relative min-w-0 flex-1 bg-background">
          <Canvas
            topInset={view.lines.length ? LINE_ENDPOINT_HEADER : 0}
            controller={canvas}
            width={bounds.width}
            height={bounds.height}
            background={
              <StagesBands
                stages={view.stages}
                width={bounds.width}
                onStartResize={(stageId, bandTop) => {
                  deselect();
                  resizing.current = { stageId, bandTop };
                }}
              />
            }
          >
            {resizePreview !== null ? (
              <line
                data-testid="stage-resize-preview"
                x1={0}
                y1={resizePreview}
                x2={bounds.width}
                y2={resizePreview}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            ) : null}
            <LineColumns
              lines={view.lines}
              height={bounds.height}
              showEndpoints={false}
            />
            <WireSegments
              wires={view.explicitWires}
              variant="explicit"
              layer="hit"
              selectedKey={selectedWireId}
              onSelect={(id) => {
                setSelectedWireId(id);
                setSelectedId(null);
              }}
            />
            {view.positioned.map(({ component, x, y }) => {
              const moving = component.id === draggingId && movePreview?.valid;
              const drawX = moving ? movePreview.x : x;
              const drawY = moving ? movePreview.y : y;
              const size = componentSize(
                component,
                component.custom_def_id
                  ? view.customDefById.get(component.custom_def_id)
                  : null,
              );
              const box = componentBox(
                { x: drawX, y: drawY },
                size,
                effectiveRotation(component, view.orientation),
              );
              return (
                <g
                  key={component.id}
                  data-testid={
                    component.line_endpoint_id
                      ? `line-endpoint-${component.line_endpoint_id}`
                      : `component-${component.id}`
                  }
                  role="button"
                  tabIndex={0}
                  aria-label={
                    component.line_endpoint_id
                      ? `${component.label}: ${component.component_type === "output_port" ? "Output" : component.component_type === "bidir_port" ? "Bidirectional" : "Input"} line endpoint`
                      : component.label ||
                        (component.custom_def_id
                          ? view.customDefById.get(component.custom_def_id)
                              ?.name
                          : null) ||
                        COMPONENT_LIBRARY[
                          component.component_type as BuiltInComponentType
                        ]?.label
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                      setSelectedId(component.id);
                      setSelectedWireId(null);
                    }
                  }}
                  onPointerEnter={() => setHoveredId(component.id)}
                  onPointerLeave={() =>
                    setHoveredId((id) => (id === component.id ? null : id))
                  }
                  onPointerDown={(event: ReactPointerEvent<SVGGElement>) => {
                    if (event.button !== 0) return;
                    event.stopPropagation();
                    if (connectingRef.current) return;
                    dragStart.current = canvas.toLogical(
                      event.clientX,
                      event.clientY,
                    );
                    setDraggingId(component.id);
                    setSelectedId(component.id);
                    setSelectedWireId(null);
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(component.id);
                    setSelectedWireId(null);
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
                    def={
                      component.custom_def_id
                        ? view.customDefById.get(component.custom_def_id)
                        : null
                    }
                    x={drawX}
                    y={drawY}
                    orientation={view.orientation}
                    showCaption={false}
                  />
                  {component.line_endpoint_id ? (
                    <LineEndpointCaption
                      line={view.lines.find(
                        (line) => line.id === component.line_endpoint_id,
                      )!}
                      x={drawX}
                      y={drawY}
                    />
                  ) : (
                    <ComponentCaption
                      component={component}
                      def={
                        component.custom_def_id
                          ? view.customDefById.get(component.custom_def_id)
                          : null
                      }
                      x={drawX}
                      y={drawY}
                    />
                  )}
                  {hoveredId === component.id
                    ? view.portAnchors
                        .filter((anchor) => anchor.componentId === component.id)
                        .map((anchor) => (
                          <circle
                            key={`${anchor.port.side}-${anchor.port.index}`}
                            data-testid={`port-${component.id}-${anchor.port.side}-${anchor.port.index}`}
                            role="button"
                            aria-label={`Connect ${component.label || component.component_type} ${anchor.port.side} ${anchor.port.index + 1}`}
                            cx={anchor.point.x}
                            cy={anchor.point.y}
                            r={6}
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth={1.5}
                            style={{ cursor: "crosshair" }}
                            onPointerDown={(event) => {
                              if (event.button !== 0) return;
                              event.preventDefault();
                              event.stopPropagation();
                              setSelectedWireId(null);
                              setDraggingId(null);
                              setMovePreview(null);
                              setConnection({
                                from: anchor,
                                cursor: anchor.point,
                              });
                            }}
                          />
                        ))
                    : null}
                </g>
              );
            })}
            <WireSegments
              wires={view.explicitWires}
              variant="explicit"
              layer="visual"
              selectedKey={selectedWireId}
            />
            <WireJunctions points={view.junctions} />
            {connecting ? (
              <line
                x1={connecting.from.point.x}
                y1={connecting.from.point.y}
                x2={connecting.cursor.x}
                y2={connecting.cursor.y}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            ) : null}
            {placing && ghost ? (
              <g opacity={ghost.valid ? 0.7 : 0.3} pointerEvents="none">
                <ComponentSymbol
                  component={
                    {
                      component_type:
                        placing.kind === "builtin" ? placing.type : "custom",
                      custom_def_id:
                        placing.kind === "custom" ? placing.defId : null,
                      rotation: 0,
                      mirrored: false,
                      label: null,
                      value:
                        placing.kind === "builtin"
                          ? (COMPONENT_LIBRARY[placing.type].defaultFields
                              .value ?? null)
                          : null,
                      linked_line_id: null,
                      line_endpoint_id: null,
                      line_entry_port: null,
                      line_exit_port: null,
                    } as Component
                  }
                  def={
                    placing.kind === "custom"
                      ? view.customDefById.get(placing.defId)
                      : null
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
        {selectedWire ? (
          <WirePropertiesPanel
            key={selectedWire.id}
            properties={selectedWire.wire_properties}
            readOnly={false}
            endpoints={`${view.positioned.find((p) => p.component.id === selectedWire.from_component_id)?.component.label || "Port"} → ${view.positioned.find((p) => p.component.id === selectedWire.to_component_id)?.component.label || "Port"}`}
            onDelete={deleteWire}
            onSave={(patch) =>
              setState((current) => ({
                ...current,
                connections: current.connections.map((wire) =>
                  wire.id === selectedWire.id
                    ? {
                        ...wire,
                        wire_properties: { ...wire.wire_properties, ...patch },
                      }
                    : wire,
                ),
              }))
            }
          />
        ) : selectedComponent ? (
          <PropertiesPanel
            key={`component:${selectedId}`}
            selection={{
              kind: "component",
              component: selectedComponent,
              def: selectedDef ?? null,
            }}
            readOnly={false}
            onSave={saveSelectedMetadata}
            onRotate={rotateSelected}
            onMirror={mirrorSelected}
            lines={state.lines}
            footer={
              isSignalPort(selectedComponent) ? (
                <SignalMatches
                  state={state}
                  componentId={selectedComponent.id}
                  onJump={(id) => {
                    setSelectedId(id);
                    setSelectedWireId(null);
                    const placed = view.positioned.find(
                      (p) => p.component.id === id,
                    );
                    if (placed) canvas.centerOn({ x: placed.x, y: placed.y });
                  }}
                />
              ) : selectedDef ? (
                <button
                  type="button"
                  onClick={() =>
                    setCustomModal({ mode: "edit", def: selectedDef })
                  }
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-background"
                >
                  Edit definition
                </button>
              ) : undefined
            }
          />
        ) : null}
      </div>

      {customModal ? (
        <CustomComponentModal
          mode={customModal.mode}
          initial={
            customModal.mode === "edit"
              ? defToFormValues(customModal.def)
              : undefined
          }
          onSubmit={submitCustom}
          onClose={() => setCustomModal(null)}
        />
      ) : null}

      <div className="flex items-center gap-4 border-t border-border bg-surface px-4 py-1 text-xs text-muted">
        <span>
          {
            state.components.filter((component) => !component.line_endpoint_id)
              .length
          }{" "}
          components
        </span>
        <span aria-hidden="true" className="text-border">
          |
        </span>
        <span>
          Drag between ports to wire · Scroll or Space+drag to pan · pinch or
          ⌘/Ctrl+scroll to zoom
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
