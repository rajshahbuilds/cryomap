"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Component,
  CustomComponentDef,
  Sheet,
  SheetKind,
} from "@/lib/types";
import type { Point } from "@/lib/diagram/camera";
import {
  connectionExists,
  findNearestPort,
  type PortAnchor,
} from "@/lib/diagram/connect";
import {
  customDefUsageCount,
  defToFormValues,
  type CustomDefFormValues,
} from "@/lib/diagram/customDef";
import { Canvas } from "./Canvas";
import { AnnotationLayer } from "./AnnotationLayer";
import { ComponentPalette, type PaletteSelection } from "./ComponentPalette";
import { ComponentSymbol, ComponentCaption } from "./ComponentSymbol";
import { CheckInModal, type CheckInValues } from "./CheckInModal";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { CustomComponentModal } from "./CustomComponentModal";
import { LineChains } from "./LineChains";
import { LineColumns } from "./LineColumns";
import { LineModal } from "./LineModal";
import { LinesBar } from "./LinesBar";
import { LockBanner } from "./LockBanner";
import { LockExpiryModal } from "./LockExpiryModal";
import { PropertiesPanel, type PanelSelection } from "./PropertiesPanel";
import { StageModal } from "./StageModal";
import { StagesBands } from "./StagesBands";
import { StagesBar } from "./StagesBar";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { VersionSidebar } from "./VersionSidebar";
import { WireJunctions, WireSegments } from "./WireSegment";
import { useBeforeUnloadGuard } from "@/lib/hooks/useBeforeUnloadGuard";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { useDiagram } from "@/lib/hooks/useDiagram";
import { useOnline } from "@/lib/hooks/useOnline";
import { useToast } from "@/components/toast/ToastProvider";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { useLock } from "@/lib/hooks/useLock";
import { useProfile } from "@/lib/hooks/useProfile";
import { useProfileById } from "@/lib/hooks/useProfileById";
import { useUndoRedo } from "@/lib/hooks/useUndoRedo";
import { useVersions } from "@/lib/hooks/useVersions";
import { checkInFridge } from "@/lib/diagram/checkin";
import { restoreVersion } from "@/lib/diagram/restore";
import { loadDiagramState } from "@/lib/diagram/load";
import { serializeSnapshot } from "@/lib/types";
import { downloadJson, exportFilename } from "@/lib/diagram/exportJson";
import { exportPdf, exportPng } from "@/lib/diagram/exportImage";
import type { ExportFormat } from "./Toolbar";
import { tracedChainsForLine } from "@/lib/diagram/trace";
import { zoomPercent } from "@/lib/diagram/status";
import { lockRecovery, type LockRecovery } from "@/lib/locks/state";
import { errorToMessage } from "@/lib/toast/errorMessage";
import type { Version } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { stagesHeight } from "@/lib/diagram/stages";
import {
  resolvePlacement,
  componentBox,
  positionFieldsOf,
  type Box,
} from "@/lib/diagram/placement";
import {
  baseRotationForType,
  componentSize,
  effectiveRotation,
} from "@/lib/diagram/componentGeometry";
import { diagramBounds } from "@/lib/diagram/bounds";
import { createPlacedComponent } from "@/lib/diagram/place";
import { useSheets } from "@/lib/hooks/useSheets";
import { SheetTabs } from "./SheetTabs";
import { toggleSelection } from "@/lib/diagram/selection";
import { nextRotation } from "@/lib/diagram/ports";
import {
  deleteComponent,
  duplicateComponent,
  mirrorComponent,
  moveComponentTo,
  setComponentPosition,
  recreateComponent,
  rotateComponent,
} from "@/lib/diagram/componentService";
import {
  componentsShiftedByReorder,
  componentsShiftedByResize,
  moveLine,
  resizeLineGap,
} from "@/lib/diagram/lineOps";
import { moveStage, resizeStageHeight } from "@/lib/diagram/stageOps";
import {
  getComponentDefinition,
  type BuiltInComponentDefinition,
} from "@/lib/constants/componentLibrary";
import {
  addAnnotationCommand,
  addCustomDefCommand,
  addConnectionCommand,
  addLineCommand,
  addSheetCommand,
  addStageCommand,
  annotationPatchCommand,
  componentPatchCommand,
  componentXShiftCommand,
  deleteAnnotationCommand,
  deleteConnectionCommand,
  customDefPatchCommand,
  deleteCustomDefCommand,
  deleteLineCommand,
  deleteSheetCommand,
  deleteStageCommand,
  fridgePatchCommand,
  linePatchCommand,
  sheetPatchCommand,
  lineOrderCommand,
  sequenceCommand,
  stageOrderCommand,
  stagePatchCommand,
} from "@/lib/diagram/editCommands";

function Overlay({
  children,
  tone = "default",
  subtle = false,
}: {
  children: ReactNode;
  tone?: "default" | "error";
  subtle?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm ${
        tone === "error" ? "text-status-broken" : "text-muted"
      } ${subtle ? "items-start pt-10" : ""}`}
    >
      <span>{children}</span>
    </div>
  );
}

function formatSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

interface Placing {
  selection: PaletteSelection;
  def: BuiltInComponentDefinition | null;
}

interface Ghost {
  x: number;
  y: number;
  allowed: boolean;
}

/**
 * Diagram editor: loads the fridge's live state, surfaces lock state, and — when
 * the current user holds the lock — offers a component palette with drag-to-place
 * (snap preview + drop creates the component). Read-only otherwise.
 */
export function DiagramEditor({
  fridgeId,
  userId,
  canEditRole = true,
}: {
  fridgeId: string;
  userId: string;
  /** Whether the user's workspace role permits editing (editor+). Viewers get a
   * read-only editor and can't check out. */
  canEditRole?: boolean;
}) {
  const sheetTabs = useSheets();
  const {
    status,
    view,
    state: diagramState,
    fridge,
    error,
    reload,
  } = useDiagram(fridgeId, sheetTabs.requestedId);
  // The sheet being edited, resolved by `assembleDiagram` against what exists.
  const activeSheet = view?.sheet ?? null;
  const isFridgeSheet = activeSheet == null || activeSheet.kind === "fridge";
  const { versions, reload: reloadVersions } = useVersions(fridgeId);
  const lock = useLock(fridgeId, userId);
  const me = useProfile();
  const holder = useProfileById(
    lock.state === "LOCKED_BY_OTHER" ? lock.holderId : null,
  );
  const toast = useToast();
  const online = useOnline();

  const [busy, setBusy] = useState(false);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [movePreview, setMovePreview] = useState<{
    id: string;
    x: number;
    y: number;
    valid: boolean;
  } | null>(null);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    component: Component;
  } | null>(null);
  const [clipboard, setClipboard] = useState<Component[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  // A component to center once its sheet's view is loaded (set when jumping
  // from a traced chain to a hop on another sheet; consumed by an effect that
  // only pans the camera — a ref, so it never re-renders).
  const pendingFocus = useRef<string | null>(null);
  const [resizePreview, setResizePreview] = useState<{ bottom: number } | null>(
    null,
  );
  const [lineMovePreview, setLineMovePreview] = useState<{
    x: number;
  } | null>(null);
  const [customModal, setCustomModal] = useState<
    { mode: "create" } | { mode: "edit"; def: CustomComponentDef } | null
  >(null);
  // An in-progress port-to-port connection drag: the source port + anchor and
  // the live cursor (logical). Read via a ref inside the canvas pointer
  // handlers so they don't need it in their dep arrays.
  const [connecting, setConnecting] = useState<{
    from: PortAnchor;
    cursor: Point;
  } | null>(null);
  const connectingRef = useRef(connecting);
  useEffect(() => {
    connectingRef.current = connecting;
  });
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<
    string | null
  >(null);
  // A pending note opened by double-clicking empty canvas, in logical coords.
  const [draftNote, setDraftNote] = useState<{ x: number; y: number } | null>(
    null,
  );
  // Which component's ports are revealed (hover), so handles aren't always shown.
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(
    null,
  );
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [lineModalOpen, setLineModalOpen] = useState(false);
  const [stageModalOpen, setStageModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expiry, setExpiry] = useState<Exclude<LockRecovery, "none"> | null>(
    null,
  );
  const [exporting, setExporting] = useState(false);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const resizing = useRef<{ stageId: string; bandTop: number } | null>(null);
  const lineMoving = useRef<{ lineId: string; prevTrunkX: number } | null>(
    null,
  );
  // Distinguishes a deliberate release (check-in / discard) from an external
  // lock loss, so the recovery modal only fires on the latter.
  const intentionalRelease = useRef(false);
  const prevLockState = useRef(lock.state);

  const {
    apply: applyEdit,
    undo: undoEdit,
    redo: redoEdit,
    reset: resetUndo,
    canUndo,
    canRedo,
    isDirty: undoDirty,
  } = useUndoRedo(reload, (error) =>
    toast.error(errorToMessage(error, "Couldn’t save your change")),
  );

  // Editing also requires an editor+ role, so a viewer holding a stale lock (or
  // any edge case) still can't mutate.
  const canEdit = lock.state === "LOCKED_BY_ME" && canEditRole;
  useBeforeUnloadGuard(canEdit && undoDirty);

  // A room-temp sheet has no stages or lines by design, so the fridge sheet's
  // "add a stage and a line" prompt would be advice the user can't take.
  const emptySheetMessage = isFridgeSheet
    ? canEdit
      ? "Add a temperature stage and a line to begin, then drag components from the palette onto a line × stage."
      : "Nothing here yet — no stages, lines, or components."
    : canEdit
      ? "Drag a component from the palette onto the canvas to begin."
      : "Nothing here yet — no components.";

  const runLock =
    (action: () => Promise<void>, context: string) => async () => {
      setBusy(true);
      try {
        await action();
      } catch (error) {
        toast.error(errorToMessage(error, context));
      } finally {
        setBusy(false);
      }
    };

  const handleCheckOut = runLock(async () => {
    if (!canEditRole) return; // viewers can't check out
    await lock.checkOut();
    resetUndo();
  }, "Couldn’t check out");
  const handleRelease = runLock(async () => {
    await lock.release();
    resetUndo();
  }, "Couldn’t release the lock");

  const handleDiscard = () => {
    if (
      undoDirty &&
      !window.confirm("Discard unsaved changes and release the lock?")
    ) {
      return;
    }
    // A deliberate release: suppress the lock-expiry recovery modal.
    intentionalRelease.current = true;
    void handleRelease();
  };

  const handleCheckIn = useCallback(() => {
    if (lock.state === "LOCKED_BY_ME") setCheckInOpen(true);
  }, [lock.state]);

  const handleConfirmCheckIn = (values: CheckInValues) => {
    setBusy(true);
    intentionalRelease.current = true;
    void (async () => {
      try {
        await checkInFridge(createSupabaseBrowserClient(), {
          fridgeId,
          message: values.message,
          tag: values.tag,
          snapshotType: values.snapshotType,
          authorId: userId,
          authorName: me.profile?.displayName ?? me.profile?.email ?? null,
        });
        resetUndo();
        setCheckInOpen(false);
        await lock.refresh();
        reload();
        reloadVersions();
        toast.success("Checked in.");
      } catch (error) {
        intentionalRelease.current = false;
        toast.error(errorToMessage(error, "Check-in failed"));
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleRestore = (version: Version) => {
    if (
      !window.confirm(
        `Restore "${version.commit_message}"? This replaces the current diagram.`,
      )
    ) {
      return;
    }
    setBusy(true);
    void (async () => {
      try {
        await restoreVersion(createSupabaseBrowserClient(), fridgeId, version, {
          authorId: userId,
          authorName: me.profile?.displayName ?? me.profile?.email ?? null,
        });
        resetUndo();
        reload();
        reloadVersions();
        toast.success("Diagram restored.");
      } catch (error) {
        toast.error(errorToMessage(error, "Restore failed"));
      } finally {
        setBusy(false);
      }
    })();
  };

  // Surface connectivity changes so the user knows saves are paused offline.
  const wasOnline = useRef(online);
  useEffect(() => {
    if (wasOnline.current && !online) {
      toast.warning(
        "You’re offline — changes can’t be saved until you reconnect.",
      );
    } else if (!wasOnline.current && online) {
      toast.success("Back online.");
    }
    wasOnline.current = online;
  }, [online, toast]);

  // Detect a lost checkout (TTL expiry mid-edit) and offer recovery. A
  // deliberate release (check-in / discard) is filtered out via the ref.
  useEffect(() => {
    const prev = prevLockState.current;
    prevLockState.current = lock.state;
    if (prev === lock.state) return;
    if (intentionalRelease.current) {
      if (lock.state !== "LOCKED_BY_ME") intentionalRelease.current = false;
      return;
    }
    const recovery = lockRecovery(prev, lock.state);
    if (recovery !== "none") setExpiry(recovery);
  }, [lock.state]);

  const handleReacquire = () => {
    setExpiry(null);
    void handleCheckOut();
  };

  const handleExportState = () => {
    void (async () => {
      try {
        const state = await loadDiagramState(
          createSupabaseBrowserClient(),
          fridgeId,
        );
        downloadJson(
          exportFilename(fridge?.name, "json"),
          serializeSnapshot(state),
        );
        toast.success("Exported current state as JSON.");
      } catch (error) {
        toast.error(errorToMessage(error, "Export failed"));
      }
    })();
  };

  const handleExport = (format: ExportFormat) => {
    if (format === "json") {
      handleExportState();
      return;
    }
    const svg = canvas.getElement();
    if (!svg || !bounds) {
      toast.error("The diagram isn’t ready to export yet.");
      return;
    }
    setExporting(true);
    void (async () => {
      try {
        const filename = exportFilename(fridge?.name, format);
        if (format === "png") await exportPng(svg, bounds, filename);
        else await exportPdf(svg, bounds, filename);
        toast.success(`Exported the diagram as ${format.toUpperCase()}.`);
      } catch (error) {
        toast.error(errorToMessage(error, "Export failed"));
      } finally {
        setExporting(false);
      }
    })();
  };

  const startPlace = useCallback((selection: PaletteSelection) => {
    setPlacing({
      selection,
      def:
        selection.kind === "builtin"
          ? getComponentDefinition(selection.type)
          : null,
    });
    setGhost(null);
  }, []);

  const cancelPlace = useCallback(() => {
    setPlacing(null);
    setGhost(null);
  }, []);

  // Footprints of the placed components (optionally excluding the one being
  // moved) so a drop can be rejected when it would overlap another component.
  const obstaclesExcept = useCallback(
    (excludeId?: string): Box[] => {
      if (!view) return [];
      return view.positioned
        .filter((p) => p.component.id !== excludeId)
        .map((p) => {
          const def = p.component.custom_def_id
            ? (view.customDefById.get(p.component.custom_def_id) ?? null)
            : null;
          return componentBox(
            { x: p.x, y: p.y },
            componentSize(p.component, def),
            effectiveRotation(p.component, view.orientation),
          );
        });
    },
    [view],
  );

  // Resolve where a palette component would land (snap to grid, allowed stage
  // or white space, clear of other components).
  const resolveTarget = useCallback(
    (point: Point) => {
      if (!view || !placing) return null;
      const selection = placing.selection;
      const customDef =
        selection.kind === "custom"
          ? (view.customDefById.get(selection.defId) ?? null)
          : null;
      const size = placing.def
        ? placing.def.defaultSize
        : customDef
          ? { width: customDef.width_px, height: customDef.height_px }
          : { width: 80, height: 40 };
      return resolvePlacement({
        point,
        size,
        rotation: placing.def
          ? baseRotationForType(placing.def.type, view.orientation)
          : 0,
        stages: view.stages,
        lines: view.lines,
        obstacles: obstaclesExcept(),
      });
    },
    [view, placing, obstaclesExcept],
  );

  // Resolve where an existing component would land when dragged to `point`.
  const resolvePlacementFor = useCallback(
    (component: Component, point: Point) => {
      if (!view) return null;
      const def = component.custom_def_id
        ? (view.customDefById.get(component.custom_def_id) ?? null)
        : null;
      return resolvePlacement({
        point,
        size: componentSize(component, def),
        rotation: effectiveRotation(component, view.orientation),
        stages: view.stages,
        lines: view.lines,
        obstacles: obstaclesExcept(component.id),
      });
    },
    [view, obstaclesExcept],
  );

  const handleMove = useCallback(
    (point: Point) => {
      if (connectingRef.current) {
        setConnecting((c) => (c ? { ...c, cursor: point } : c));
        return;
      }

      if (resizing.current) {
        const height = resizeStageHeight(resizing.current.bandTop, point.y);
        setResizePreview({ bottom: resizing.current.bandTop + height });
        return;
      }

      if (lineMoving.current) {
        const gap = resizeLineGap(lineMoving.current.prevTrunkX, point.x);
        setLineMovePreview({ x: lineMoving.current.prevTrunkX + gap });
        return;
      }

      if (placing) {
        const resolved = resolveTarget(point);
        setGhost(
          resolved
            ? { x: resolved.x, y: resolved.y, allowed: resolved.valid }
            : null,
        );
        return;
      }

      if (drag.current && view) {
        drag.current.moved = true;
        const component = view.positioned.find(
          (p) => p.component.id === drag.current!.id,
        )?.component;
        if (!component) return;
        const resolved = resolvePlacementFor(component, point);
        if (resolved) {
          setMovePreview({
            id: component.id,
            x: resolved.x,
            y: resolved.y,
            valid: resolved.valid,
          });
        }
      }
    },
    [placing, resolveTarget, resolvePlacementFor, view],
  );

  const handleUp = useCallback(
    (point: Point) => {
      const pending = connectingRef.current;
      if (pending) {
        setConnecting(null);
        if (!view) return;
        const target = findNearestPort(
          view.portAnchors,
          point,
          undefined,
          pending.from.componentId,
        );
        if (
          target &&
          !connectionExists(view.connections, pending.from, target)
        ) {
          applyEdit(
            addConnectionCommand({
              fridge_id: fridgeId,
              sheet_id: activeSheet?.id ?? null,
              from_component_id: pending.from.componentId,
              from_port_side: pending.from.port.side,
              from_port_index: pending.from.port.index,
              to_component_id: target.componentId,
              to_port_side: target.port.side,
              to_port_index: target.port.index,
            }),
          );
        }
        return;
      }

      if (resizing.current) {
        const { stageId, bandTop } = resizing.current;
        resizing.current = null;
        setResizePreview(null);
        const height = resizeStageHeight(bandTop, point.y);
        const before = view?.stages.find((s) => s.id === stageId)?.height_px;
        if (before != null && before !== height) {
          applyEdit(
            stagePatchCommand(
              stageId,
              { height_px: before },
              { height_px: height },
            ),
          );
        }
        return;
      }

      if (lineMoving.current) {
        const { lineId, prevTrunkX } = lineMoving.current;
        lineMoving.current = null;
        setLineMovePreview(null);
        const width = resizeLineGap(prevTrunkX, point.x);
        const before = view?.lines.find((l) => l.id === lineId)?.width_px;
        if (view && before != null && before !== width) {
          // Dragging the trunk slides this line and everything to its right, so
          // carry the components in that region along with it.
          const shifts = componentsShiftedByResize(
            prevTrunkX + before,
            width - before,
            view.positioned.map((p) => p.component),
          );
          applyEdit(
            sequenceCommand(
              linePatchCommand(
                lineId,
                { width_px: before },
                { width_px: width },
              ),
              componentXShiftCommand(shifts),
            ),
          );
        } else {
          // No drag — a plain click on the trunk selects the line (and shows its
          // signal chains), the same as clicking its label.
          setSelectedIds([]);
          setSelectedConnectionId(null);
          setSelectedLineId(lineId);
        }
        return;
      }

      if (placing) {
        const resolved = resolveTarget(point);
        const selection = placing.selection;
        cancelPlace();
        if (!resolved || !resolved.valid || !resolved.target) return;
        // Every fridge has a sheet once the backfill has run; a restore
        // synthesizes one. Nothing to place onto otherwise.
        if (!activeSheet) return;
        const target = resolved.target;
        const input = {
          fridgeId,
          sheetId: activeSheet.id,
          componentType:
            selection.kind === "builtin" ? selection.type : ("custom" as const),
          customDefId: selection.kind === "custom" ? selection.defId : null,
          target,
        };
        let createdId: string | null = null;
        applyEdit({
          redo: async (db) => {
            createdId = (await createPlacedComponent(db, input)).id;
          },
          undo: async (db) => {
            if (createdId) await deleteComponent(db, createdId);
          },
        });
        return;
      }

      const dragging = drag.current;
      drag.current = null;
      setMovePreview(null);

      if (dragging?.moved && view) {
        const component = view.positioned.find(
          (p) => p.component.id === dragging.id,
        )?.component;
        if (component) {
          const resolved = resolvePlacementFor(component, point);
          // Reject an overlapping / disallowed drop: the component snaps back.
          if (resolved?.valid && resolved.target) {
            const id = component.id;
            const before = positionFieldsOf(component);
            const target = resolved.target;
            applyEdit({
              redo: async (db) => {
                await moveComponentTo(db, id, target);
              },
              undo: async (db) => {
                await setComponentPosition(db, id, before);
              },
            });
          }
        }
        return;
      }

      // A click on empty canvas clears the selection.
      if (!dragging) {
        setSelectedIds([]);
        setSelectedLineId(null);
        setSelectedConnectionId(null);
      }
    },
    [
      placing,
      resolveTarget,
      resolvePlacementFor,
      cancelPlace,
      fridgeId,
      applyEdit,
      view,
      activeSheet,
    ],
  );

  // Lifted here (rather than inside Canvas) so the toolbar and status bar can
  // read the zoom level and drive the zoom controls.
  const canvas = useCanvas({
    onLogicalPointerMove: handleMove,
    onLogicalPointerUp: handleUp,
  });

  const handleRenameFridge = (name: string) => {
    if (!fridge || !name || name === fridge.name) return;
    applyEdit(fridgePatchCommand(fridge.id, { name: fridge.name }, { name }));
  };

  // Sheets ------------------------------------------------------------------
  const handleAddSheet = (kind: SheetKind) => {
    if (!view) return;
    applyEdit(addSheetCommand(fridgeId, view.sheets, { kind }));
  };

  const handleRenameSheet = (id: string, name: string) => {
    const before = view?.sheets.find((s) => s.id === id)?.name;
    if (before === undefined || before === name) return;
    applyEdit(sheetPatchCommand(id, { name: before }, { name }));
  };

  const handleDeleteSheet = (sheet: Sheet) => {
    if (!diagramState) return;
    // Deleting a sheet takes everything drawn on it, so capture all four layers
    // for the undo. Read from the whole-fridge state, not `view` — `view` holds
    // only the active sheet's rows, and any tab can be deleted.
    const onSheet = <T extends { sheet_id: string | null }>(rows: T[]) =>
      rows.filter((row) => row.sheet_id === sheet.id);
    applyEdit(
      deleteSheetCommand(sheet, {
        stages: onSheet(diagramState.stages),
        lines: onSheet(diagramState.lines),
        components: onSheet(diagramState.components),
        connections: onSheet(diagramState.connections),
      }),
    );
  };

  // Annotations -------------------------------------------------------------
  // Double-clicking empty canvas opens a draft note editor at that point.
  const handleCanvasDoubleClick = (point: { x: number; y: number }) => {
    if (!canEdit) return;
    setSelectedAnnotationId(null);
    setDraftNote({ x: Math.round(point.x), y: Math.round(point.y) });
  };

  const handleCreateNote = (text: string, x: number, y: number) => {
    if (!activeSheet) return;
    applyEdit(
      addAnnotationCommand({
        fridge_id: fridgeId,
        sheet_id: activeSheet.id,
        text,
        x_abs: x,
        y_abs: y,
      }),
    );
  };

  const handleMoveAnnotation = (id: string, x: number, y: number) => {
    const before = diagramState?.annotations.find((a) => a.id === id);
    if (!before || (before.x_abs === x && before.y_abs === y)) return;
    applyEdit(
      annotationPatchCommand(
        id,
        { x_abs: before.x_abs, y_abs: before.y_abs },
        { x_abs: x, y_abs: y },
      ),
    );
  };

  const handleEditAnnotation = (id: string, text: string) => {
    const before = diagramState?.annotations.find((a) => a.id === id);
    if (!before || before.text === text) return;
    applyEdit(annotationPatchCommand(id, { text: before.text }, { text }));
  };

  const handleDeleteAnnotation = (id: string) => {
    const annotation = diagramState?.annotations.find((a) => a.id === id);
    setSelectedAnnotationId(null);
    if (annotation) applyEdit(deleteAnnotationCommand(annotation));
  };

  // Signal tracing --------------------------------------------------
  // Jump from a traced-chain hop to its component: select it, switch to its
  // sheet if needed, and center on it. Selection happens now (an event handler);
  // centering waits for the target sheet's view (the effect below), since the
  // component's position isn't known until then.
  const handleJumpToComponent = (
    componentId: string,
    sheetId: string | null,
  ) => {
    setSelectedIds([componentId]);
    setSelectedLineId(null);
    setSelectedConnectionId(null);
    if (sheetId && sheetId !== activeSheet?.id) sheetTabs.select(sheetId);
    // Center now if the component is already on-screen, else once its view loads.
    const hit = view?.positioned.find((p) => p.component.id === componentId);
    if (hit) canvas.centerOn({ x: hit.x, y: hit.y });
    else pendingFocus.current = componentId;
  };

  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const hit = view?.positioned.find((p) => p.component.id === id);
    if (!hit) return; // target sheet still loading — retry when `view` updates
    canvas.centerOn({ x: hit.x, y: hit.y });
    pendingFocus.current = null;
  }, [view, canvas]);

  // Escape cancels an in-progress placement.
  useEffect(() => {
    if (!placing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelPlace();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placing, cancelPlace]);

  const ghostComponent = placing
    ? ({
        id: "__ghost__",
        component_type:
          placing.selection.kind === "builtin"
            ? placing.selection.type
            : "custom",
        custom_def_id:
          placing.selection.kind === "custom" ? placing.selection.defId : null,
        rotation: 0,
        label: null,
        value: null,
      } as unknown as Component)
    : null;

  const defFor = (component: Component) =>
    component.custom_def_id
      ? (view?.customDefById.get(component.custom_def_id) ?? null)
      : null;

  /** The fridge line a fridge_port links to, by name (for its in-tag label). */
  const linkedLineNameFor = (component: Component) =>
    component.linked_line_id
      ? (view?.lineNameById.get(component.linked_line_id) ?? null)
      : null;

  const onComponentPointerDown = (
    e: React.PointerEvent<SVGGElement>,
    id: string,
  ) => {
    if (!canEdit || e.button !== 0) return;
    drag.current = { id, moved: false };
  };

  // Begin dragging a wire from a component port; the canvas pointer handlers
  // track the cursor and complete/cancel the connection on release.
  const startConnect = (e: React.PointerEvent, anchor: PortAnchor) => {
    if (!canEdit || e.button !== 0) return;
    e.stopPropagation();
    setSelectedConnectionId(null);
    setConnecting({ from: anchor, cursor: anchor.point });
  };

  /** Select an explicit connection (clears other selections). */
  const selectConnection = (id: string) => {
    setSelectedIds([]);
    setSelectedLineId(null);
    setSelectedConnectionId(id);
  };

  const onComponentClick = (e: React.MouseEvent<SVGGElement>, id: string) => {
    // Selection is allowed read-only too, so the properties panel can inspect a
    // component without holding the lock; mutations stay gated by `canEdit`.
    e.stopPropagation();
    setSelectedLineId(null);
    setSelectedConnectionId(null);
    setSelectedIds((current) => toggleSelection(current, id, e.shiftKey));
  };

  const onComponentContextMenu = (
    e: React.MouseEvent<SVGGElement>,
    component: Component,
  ) => {
    if (!canEdit) return;
    e.preventDefault();
    setSelectedLineId(null);
    setSelectedIds([component.id]);
    setMenu({ x: e.clientX, y: e.clientY, component });
  };

  const selectLine = (lineId: string) => {
    // Allowed read-only as well (view line properties); see onComponentClick.
    setSelectedIds([]);
    setSelectedConnectionId(null);
    setSelectedLineId(lineId);
  };

  const selectedSet = new Set(selectedIds);
  const highlightLineIds =
    view?.positioned
      .filter((p) => selectedSet.has(p.component.id) && p.component.line_id)
      .map((p) => p.component.line_id as string) ?? [];
  const selectedComponents =
    view?.positioned
      .filter((p) => selectedSet.has(p.component.id))
      .map((p) => p.component) ?? [];
  // Content-derived canvas size: starts compact, grows as content is added.
  const bounds = view ? diagramBounds(view) : null;

  // Rotate a set of components 90° clockwise as one undoable edit.
  const rotateComponents = (sources: Component[]) => {
    if (sources.length === 0) return;
    const items = sources.map((c) => ({
      id: c.id,
      before: c.rotation,
      after: nextRotation(c.rotation),
    }));
    applyEdit({
      redo: async (db) => {
        await Promise.all(items.map((i) => rotateComponent(db, i.id, i.after)));
      },
      undo: async (db) => {
        await Promise.all(
          items.map((i) => rotateComponent(db, i.id, i.before)),
        );
      },
    });
  };

  // Toggle horizontal mirror on a set of components as one undoable edit.
  const mirrorComponents = (sources: Component[]) => {
    if (sources.length === 0) return;
    const items = sources.map((c) => ({ id: c.id, before: c.mirrored }));
    applyEdit({
      redo: async (db) => {
        await Promise.all(
          items.map((i) => mirrorComponent(db, i.id, !i.before)),
        );
      },
      undo: async (db) => {
        await Promise.all(
          items.map((i) => mirrorComponent(db, i.id, i.before)),
        );
      },
    });
  };

  // Duplicate a set of components as one undoable edit.
  const copyComponents = (sources: Component[]) => {
    if (sources.length === 0) return;
    const items = [...sources];
    let ids: string[] = [];
    applyEdit({
      redo: async (db) => {
        const copies = await Promise.all(
          items.map((c) => duplicateComponent(db, c)),
        );
        ids = copies.map((c) => c.id);
      },
      undo: async (db) => {
        await Promise.all(ids.map((id) => deleteComponent(db, id)));
      },
    });
  };

  useKeyboardShortcuts(
    {
      deselect: () => {
        setSelectedIds([]);
        setSelectedLineId(null);
        setSelectedConnectionId(null);
        setSelectedAnnotationId(null);
        setDraftNote(null);
        setMenu(null);
        setConnecting(null);
        cancelPlace();
      },
      delete: () => {
        // A selected annotation takes priority (it's the most recently clicked).
        if (selectedAnnotationId) {
          const annotation = diagramState?.annotations.find(
            (a) => a.id === selectedAnnotationId,
          );
          setSelectedAnnotationId(null);
          if (annotation) applyEdit(deleteAnnotationCommand(annotation));
          return;
        }
        // A selected connection takes priority over component deletion.
        if (selectedConnectionId) {
          const connection = view?.connections.find(
            (c) => c.id === selectedConnectionId,
          );
          setSelectedConnectionId(null);
          if (connection) applyEdit(deleteConnectionCommand(connection));
          return;
        }
        if (selectedComponents.length === 0) return;
        let items = [...selectedComponents];
        setSelectedIds([]);
        applyEdit({
          redo: async (db) => {
            await Promise.all(items.map((c) => deleteComponent(db, c.id)));
          },
          undo: async (db) => {
            items = await Promise.all(
              items.map((c) => recreateComponent(db, c)),
            );
          },
        });
      },
      rotate: () => rotateComponents(selectedComponents),
      mirror: () => mirrorComponents(selectedComponents),
      duplicate: () => copyComponents(selectedComponents),
      copy: () => {
        if (selectedComponents.length > 0)
          setClipboard([...selectedComponents]);
      },
      paste: () => copyComponents(clipboard),
      undo: () => undoEdit(),
      redo: () => redoEdit(),
      checkin: handleCheckIn,
    },
    canEdit,
  );

  let panelSelection: PanelSelection | null = null;
  if (view) {
    if (selectedLineId) {
      const line = view.lines.find((l) => l.id === selectedLineId);
      if (line) panelSelection = { kind: "line", line };
    }
    if (!panelSelection && selectedComponents.length === 1) {
      const component = selectedComponents[0];
      panelSelection = {
        kind: "component",
        component,
        def: component.custom_def_id
          ? (view.customDefById.get(component.custom_def_id) ?? null)
          : null,
      };
    }
    if (!panelSelection && fridge) {
      panelSelection = { kind: "fridge", fridge };
    }
  }

  // Captured as a const so the rotate closure keeps the narrowed type.
  const panelComponent =
    panelSelection?.kind === "component" ? panelSelection.component : null;

  const handlePanelSave = (patch: Record<string, unknown>) => {
    if (!panelSelection) return;
    const entity =
      panelSelection.kind === "component"
        ? panelSelection.component
        : panelSelection.kind === "line"
          ? panelSelection.line
          : panelSelection.fridge;
    const id = entity.id;
    const before: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      before[key] = (entity as Record<string, unknown>)[key];
    }
    if (panelSelection.kind === "component") {
      applyEdit(componentPatchCommand(id, before, patch));
    } else if (panelSelection.kind === "line") {
      applyEdit(linePatchCommand(id, before, patch));
    } else {
      applyEdit(fridgePatchCommand(id, before, patch));
    }
  };

  const handleCustomSubmit = (values: CustomDefFormValues) => {
    if (!customModal) return;
    if (customModal.mode === "create") {
      applyEdit(
        addCustomDefCommand({ fridge_id: fridgeId, ...values }, userId),
      );
    } else {
      const def = customModal.def;
      applyEdit(
        customDefPatchCommand(
          def.id,
          {
            name: def.name,
            width_px: def.width_px,
            height_px: def.height_px,
            ports: def.ports,
            extra_field_keys: def.extra_field_keys,
          },
          values,
        ),
      );
    }
    setCustomModal(null);
  };

  const handleDeleteCustomDef = (def: CustomComponentDef) => {
    const uses = view ? customDefUsageCount(view.components, def.id) : 0;
    if (uses > 0) {
      toast.warning(
        `Can’t delete “${def.name}” — ${uses} component${uses === 1 ? "" : "s"} on the canvas use it. Remove ${uses === 1 ? "it" : "them"} first.`,
      );
      return;
    }
    applyEdit(deleteCustomDefCommand(def));
  };

  const menuItems: ContextMenuItem[] = menu
    ? [
        {
          label: "Rotate 90°",
          onSelect: () => rotateComponents([menu.component]),
        },
        {
          label: "Duplicate",
          onSelect: () => copyComponents([menu.component]),
        },
        {
          label: "Delete",
          danger: true,
          onSelect: () => {
            const id = menu.component.id;
            let item = menu.component;
            setSelectedIds((s) => s.filter((x) => x !== id));
            applyEdit({
              redo: async (db) => {
                await deleteComponent(db, item.id);
              },
              undo: async (db) => {
                item = await recreateComponent(db, item);
              },
            });
          },
        },
        ...(menu.component.component_type === "custom" &&
        menu.component.custom_def_id &&
        view?.customDefById.has(menu.component.custom_def_id)
          ? [
              {
                label: "Edit definition",
                onSelect: () => {
                  const def = view.customDefById.get(
                    menu.component.custom_def_id!,
                  );
                  if (def) setCustomModal({ mode: "edit", def });
                },
              } satisfies ContextMenuItem,
            ]
          : []),
      ]
    : [];

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        lockState={lock.state}
        busy={busy || lock.loading}
        dirty={undoDirty}
        canUndo={canUndo}
        canRedo={canRedo}
        offline={!online}
        fridgeName={fridge?.name}
        onRenameFridge={canEdit ? handleRenameFridge : undefined}
        zoomPercent={zoomPercent(canvas.camera.scale)}
        onZoomIn={canvas.zoomIn}
        onZoomOut={canvas.zoomOut}
        onZoomReset={canvas.resetView}
        showExport
        onExport={handleExport}
        exporting={exporting}
        canCheckOut={canEditRole}
        onCheckOut={handleCheckOut}
        onRelease={handleDiscard}
        onCheckIn={handleCheckIn}
        onUndo={undoEdit}
        onRedo={redoEdit}
        onToggleHistory={() => setHistoryOpen((o) => !o)}
      />
      {lock.state === "LOCKED_BY_OTHER" ? (
        <LockBanner
          holderName={holder?.displayName ?? null}
          holderAvatarUrl={holder?.avatarUrl ?? null}
          since={lock.lockedAt ? formatSince(lock.lockedAt) : null}
          onForceRelease={runLock(
            lock.forceRelease,
            "Couldn’t release the lock",
          )}
        />
      ) : null}

      {status === "ready" && view ? (
        <SheetTabs
          sheets={view.sheets}
          activeId={activeSheet?.id ?? null}
          onSelect={sheetTabs.select}
          onAdd={canEdit ? handleAddSheet : undefined}
          onRename={canEdit ? handleRenameSheet : undefined}
          onDelete={canEdit ? handleDeleteSheet : undefined}
        />
      ) : null}

      {canEdit && isFridgeSheet && status === "ready" && view ? (
        <LinesBar
          lines={view.lines}
          onAdd={() => setLineModalOpen(true)}
          onRename={(id, name) => {
            const before = view.lines.find((l) => l.id === id)?.name;
            if (before !== undefined && before !== name) {
              applyEdit(linePatchCommand(id, { name: before }, { name }));
            }
          }}
          onSetType={(id, type) => {
            const before =
              view.lines.find((l) => l.id === id)?.line_type ?? null;
            applyEdit(
              linePatchCommand(id, { line_type: before }, { line_type: type }),
            );
          }}
          onToggleLabel={(id, show) =>
            applyEdit(
              linePatchCommand(id, { show_label: !show }, { show_label: show }),
            )
          }
          onMove={(id, direction) => {
            const after = moveLine(view.lines, id, direction);
            if (!after.length) return;
            const before = after.map((u) => ({
              id: u.id,
              sort_order:
                view.lines.find((l) => l.id === u.id)?.sort_order ?? 0,
            }));
            // Reorder swaps two trunks; carry each line's components with it.
            const orderById = new Map(after.map((u) => [u.id, u.sort_order]));
            const newLines = view.lines.map((l) =>
              orderById.has(l.id)
                ? { ...l, sort_order: orderById.get(l.id)! }
                : l,
            );
            const shifts = componentsShiftedByReorder(
              view.lines,
              newLines,
              view.positioned.map((p) => p.component),
            );
            applyEdit(
              sequenceCommand(
                lineOrderCommand(before, after),
                componentXShiftCommand(shifts),
              ),
            );
          }}
          onDelete={(id) => {
            if (!window.confirm("Delete this line and its components?")) return;
            const line = view.lines.find((l) => l.id === id);
            if (!line) return;
            const components = view.positioned
              .map((p) => p.component)
              .filter((c) => c.line_id === id);
            applyEdit(deleteLineCommand(line, components));
          }}
        />
      ) : null}

      {canEdit && isFridgeSheet && status === "ready" && view ? (
        <StagesBar
          stages={view.stages}
          onAdd={() => setStageModalOpen(true)}
          onRename={(id, name) => {
            const before = view.stages.find((s) => s.id === id)?.name;
            if (before !== undefined && before !== name) {
              applyEdit(stagePatchCommand(id, { name: before }, { name }));
            }
          }}
          onSetTemp={(id, temp) => {
            const before =
              view.stages.find((s) => s.id === id)?.nominal_temp ?? null;
            applyEdit(
              stagePatchCommand(
                id,
                { nominal_temp: before },
                { nominal_temp: temp || null },
              ),
            );
          }}
          onSetColor={(id, color) => {
            const before = view.stages.find((s) => s.id === id)?.color ?? null;
            applyEdit(stagePatchCommand(id, { color: before }, { color }));
          }}
          onToggleHidden={(id, hidden) =>
            applyEdit(stagePatchCommand(id, { hidden: !hidden }, { hidden }))
          }
          onMove={(id, direction) => {
            const after = moveStage(view.stages, id, direction);
            if (!after.length) return;
            const before = after.map((u) => ({
              id: u.id,
              sort_order:
                view.stages.find((s) => s.id === u.id)?.sort_order ?? 0,
            }));
            applyEdit(stageOrderCommand(before, after));
          }}
          onDelete={(id) => {
            if (!window.confirm("Delete this stage and its components?"))
              return;
            const stage = view.stages.find((s) => s.id === id);
            if (!stage) return;
            const components = view.positioned
              .map((p) => p.component)
              .filter((c) => c.stage_id === id);
            applyEdit(deleteStageCommand(stage, components));
          }}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        {canEdit && status === "ready" ? (
          <ComponentPalette
            customDefs={view ? [...view.customDefById.values()] : []}
            onStartPlace={startPlace}
            onCreateCustom={() => setCustomModal({ mode: "create" })}
            onEditCustom={(def) => setCustomModal({ mode: "edit", def })}
            onDeleteCustom={handleDeleteCustomDef}
          />
        ) : null}

        <div className="relative min-w-0 flex-1">
          {status === "loading" ? (
            <Overlay>Loading diagram…</Overlay>
          ) : status === "error" || !view ? (
            <Overlay tone="error">
              Couldn’t load this fridge.{error ? ` ${error}` : ""}
            </Overlay>
          ) : (
            <>
              <Canvas
                controller={canvas}
                width={bounds?.width}
                height={bounds?.height}
                onBackgroundDoubleClick={
                  canEdit ? handleCanvasDoubleClick : undefined
                }
                background={
                  <StagesBands
                    stages={view.stages}
                    width={bounds?.width}
                    onStartResize={
                      canEdit
                        ? (stageId, bandTop) => {
                            resizing.current = { stageId, bandTop };
                          }
                        : undefined
                    }
                  />
                }
              >
                <LineColumns
                  lines={view.lines}
                  height={stagesHeight(view.stages) || bounds?.height}
                  highlightLineIds={
                    selectedLineId
                      ? [selectedLineId, ...highlightLineIds]
                      : highlightLineIds
                  }
                  onSelectLine={selectLine}
                  onStartMove={
                    canEdit
                      ? (lineId, prevTrunkX) => {
                          lineMoving.current = { lineId, prevTrunkX };
                        }
                      : undefined
                  }
                />
                <WireSegments wires={view.wires} />
                {/* Hit layer: beneath components so it doesn't block hovering
                    them; selects a wire clicked in open space. */}
                <WireSegments
                  wires={view.explicitWires}
                  variant="explicit"
                  layer="hit"
                  onSelect={canEdit ? selectConnection : undefined}
                  selectedKey={selectedConnectionId}
                />
                {resizePreview ? (
                  <line
                    x1={0}
                    y1={resizePreview.bottom}
                    x2={bounds?.width ?? 4000}
                    y2={resizePreview.bottom}
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    pointerEvents="none"
                  />
                ) : null}
                {lineMovePreview ? (
                  <line
                    x1={lineMovePreview.x}
                    y1={0}
                    x2={lineMovePreview.x}
                    y2={stagesHeight(view.stages) || bounds?.height || 3000}
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    pointerEvents="none"
                  />
                ) : null}
                {view.positioned.map(({ component, x, y }) => (
                  <g
                    key={component.id}
                    onPointerDown={(e) =>
                      onComponentPointerDown(e, component.id)
                    }
                    onClick={(e) => onComponentClick(e, component.id)}
                    onContextMenu={(e) => onComponentContextMenu(e, component)}
                    onPointerEnter={
                      canEdit
                        ? () => setHoveredComponentId(component.id)
                        : undefined
                    }
                    onPointerLeave={
                      canEdit
                        ? () =>
                            setHoveredComponentId((h) =>
                              h === component.id ? null : h,
                            )
                        : undefined
                    }
                    opacity={movePreview?.id === component.id ? 0.3 : 1}
                    style={{ cursor: "pointer" }}
                  >
                    {selectedSet.has(component.id) ? (
                      <circle
                        cx={x}
                        cy={y}
                        r={26}
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                      />
                    ) : null}
                    <ComponentSymbol
                      component={component}
                      def={defFor(component)}
                      x={x}
                      y={y}
                      orientation={view.orientation}
                      showCaption={false}
                      linkedLineName={linkedLineNameFor(component)}
                    />
                    {/*
                     * Port handles for this component, revealed on hover. Drawn
                     * inside the component's group so moving the pointer onto a
                     * handle doesn't count as leaving (no flicker). Drag one to
                     * start a connection.
                     */}
                    {canEdit && hoveredComponentId === component.id
                      ? view.portAnchors
                          .filter((a) => a.componentId === component.id)
                          .map((anchor) => (
                            <circle
                              key={`${anchor.port.side}-${anchor.port.index}`}
                              cx={anchor.point.x}
                              cy={anchor.point.y}
                              r={5}
                              fill="#ffffff"
                              stroke="#2563eb"
                              strokeWidth={1.5}
                              style={{ cursor: "crosshair" }}
                              onPointerDown={(e) => startConnect(e, anchor)}
                            />
                          ))
                      : null}
                  </g>
                ))}
                {movePreview
                  ? (() => {
                      const moving = view.positioned.find(
                        (p) => p.component.id === movePreview.id,
                      );
                      return moving ? (
                        <g
                          opacity={movePreview.valid ? 0.7 : 0.4}
                          pointerEvents="none"
                        >
                          <circle
                            cx={movePreview.x}
                            cy={movePreview.y}
                            r={26}
                            fill="none"
                            stroke={movePreview.valid ? "#2563eb" : "#dc2626"}
                            strokeWidth={2}
                            strokeDasharray="4 3"
                          />
                          <ComponentSymbol
                            component={moving.component}
                            def={defFor(moving.component)}
                            x={movePreview.x}
                            y={movePreview.y}
                            orientation={view.orientation}
                            linkedLineName={linkedLineNameFor(moving.component)}
                          />
                        </g>
                      ) : null;
                    })()
                  : null}
                {ghost && ghostComponent ? (
                  <g opacity={ghost.allowed ? 0.7 : 0.4} pointerEvents="none">
                    <circle
                      cx={ghost.x}
                      cy={ghost.y}
                      r={24}
                      fill="none"
                      stroke={ghost.allowed ? "#16a34a" : "#dc2626"}
                      strokeWidth={2}
                      strokeDasharray="5 3"
                    />
                    <ComponentSymbol
                      component={ghostComponent}
                      def={
                        placing?.selection.kind === "custom"
                          ? (view.customDefById.get(placing.selection.defId) ??
                            null)
                          : null
                      }
                      x={ghost.x}
                      y={ghost.y}
                      orientation={view.orientation}
                    />
                  </g>
                ) : null}
                {/*
                 * Caption layer: drawn above every glyph so no component can
                 * hide another's label. Each caption keeps the component's
                 * click/drag/context-menu handlers; the one being dragged is
                 * skipped (its label rides along with the move preview).
                 */}
                {view.positioned.map(({ component, x, y }) =>
                  movePreview?.id === component.id ? null : (
                    <g
                      key={`caption-${component.id}`}
                      onPointerDown={(e) =>
                        onComponentPointerDown(e, component.id)
                      }
                      onClick={(e) => onComponentClick(e, component.id)}
                      onContextMenu={(e) =>
                        onComponentContextMenu(e, component)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <ComponentCaption
                        component={component}
                        def={defFor(component)}
                        x={x}
                        y={y}
                      />
                    </g>
                  ),
                )}

                {/* Live preview of an in-progress connection drag. */}
                {connecting ? (
                  <line
                    x1={connecting.from.point.x}
                    y1={connecting.from.point.y}
                    x2={connecting.cursor.x}
                    y2={connecting.cursor.y}
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                ) : null}

                {/* Visual layer: on top of components so connections are never
                    hidden behind a symbol (non-interactive; the hit layer below
                    handles selection). */}
                <WireSegments
                  wires={view.explicitWires}
                  variant="explicit"
                  layer="visual"
                  selectedKey={selectedConnectionId}
                />
                <WireJunctions points={view.junctions} />
                <AnnotationLayer
                  annotations={view.annotations}
                  selectedId={selectedAnnotationId}
                  scale={canvas.camera.scale}
                  onSelect={canEdit ? setSelectedAnnotationId : undefined}
                  onMove={canEdit ? handleMoveAnnotation : undefined}
                  onEdit={canEdit ? handleEditAnnotation : undefined}
                  onDelete={canEdit ? handleDeleteAnnotation : undefined}
                  draftAt={canEdit ? draftNote : null}
                  onCreate={canEdit ? handleCreateNote : undefined}
                  onCancelDraft={() => setDraftNote(null)}
                />
              </Canvas>
              {view.stages.length === 0 &&
              view.lines.length === 0 &&
              view.positioned.length === 0 &&
              view.annotations.length === 0 ? (
                <Overlay subtle>{emptySheetMessage}</Overlay>
              ) : null}
            </>
          )}
        </div>

        {status === "ready" && panelSelection ? (
          <PropertiesPanel
            key={
              panelSelection.kind === "component"
                ? `component:${panelSelection.component.id}`
                : panelSelection.kind === "line"
                  ? `line:${panelSelection.line.id}`
                  : `fridge:${panelSelection.fridge.id}`
            }
            selection={panelSelection}
            readOnly={!canEdit}
            onSave={handlePanelSave}
            lines={diagramState?.lines ?? []}
            footer={
              panelSelection.kind === "line" && view && diagramState ? (
                <LineChains
                  lineName={panelSelection.line.name}
                  chains={tracedChainsForLine(
                    diagramState,
                    panelSelection.line.id,
                  )}
                  customDefById={view.customDefById}
                  onJump={handleJumpToComponent}
                />
              ) : undefined
            }
            onRotate={
              panelComponent
                ? () => rotateComponents([panelComponent])
                : undefined
            }
            onMirror={
              panelComponent
                ? () => mirrorComponents([panelComponent])
                : undefined
            }
          />
        ) : null}

        {historyOpen ? (
          <VersionSidebar
            fridgeId={fridgeId}
            versions={versions}
            canRestore={canEdit}
            onRestore={handleRestore}
            onClose={() => setHistoryOpen(false)}
          />
        ) : null}
      </div>

      <StatusBar
        lockState={lock.state}
        holderName={
          lock.state === "LOCKED_BY_OTHER"
            ? (holder?.displayName ?? null)
            : (me.profile?.displayName ?? me.profile?.email ?? null)
        }
        since={lock.lockedAt ? formatSince(lock.lockedAt) : null}
        versions={versions}
        componentCount={view?.positioned.length ?? 0}
        zoomPercent={zoomPercent(canvas.camera.scale)}
      />

      {menu ? (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      ) : null}

      {customModal ? (
        <CustomComponentModal
          mode={customModal.mode}
          initial={
            customModal.mode === "edit"
              ? defToFormValues(customModal.def)
              : undefined
          }
          onSubmit={handleCustomSubmit}
          onClose={() => setCustomModal(null)}
        />
      ) : null}

      {checkInOpen ? (
        <CheckInModal
          busy={busy}
          onConfirm={handleConfirmCheckIn}
          onClose={() => setCheckInOpen(false)}
        />
      ) : null}

      {lineModalOpen && view && activeSheet ? (
        <LineModal
          defaultName={`Line ${view.lines.length + 1}`}
          onConfirm={(values) => {
            applyEdit(
              addLineCommand(fridgeId, activeSheet.id, view.lines, {
                name: values.name,
                lineType: values.lineType,
                direction: values.direction,
              }),
            );
            setLineModalOpen(false);
          }}
          onClose={() => setLineModalOpen(false)}
        />
      ) : null}

      {stageModalOpen && view && activeSheet ? (
        <StageModal
          defaultName={`Stage ${view.stages.length + 1}`}
          onConfirm={(values) => {
            applyEdit(
              addStageCommand(fridgeId, activeSheet.id, view.stages, values),
            );
            setStageModalOpen(false);
          }}
          onClose={() => setStageModalOpen(false)}
        />
      ) : null}

      {expiry ? (
        <LockExpiryModal
          recovery={expiry}
          busy={busy || lock.loading}
          onReacquire={handleReacquire}
          onExport={handleExportState}
          onDismiss={() => setExpiry(null)}
        />
      ) : null}
    </div>
  );
}
