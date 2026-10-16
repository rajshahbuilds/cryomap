"use client";

import { useRef, useState } from "react";
import type { Annotation } from "@/lib/types";

interface AnnotationLayerProps {
  annotations: Annotation[];
  /**
   * Editor handlers. Omit them all for a read-only render (snapshots, exports):
   * the layer then draws plain, non-interactive text.
   */
  selectedId?: string | null;
  /** Screen-px-per-logical-unit, for scale-correct drag deltas. */
  scale?: number;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  /**
   * A pending new note (logical coords) opened by double-clicking empty canvas.
   * Renders an empty editor; committing non-empty text calls `onCreate`.
   */
  draftAt?: { x: number; y: number } | null;
  onCreate?: (text: string, x: number, y: number) => void;
  onCancelDraft?: () => void;
}

const FONT_SIZE = 14;
const LINE_HEIGHT = 18;
const PADDING = 6;

/** Rough text width so the selection box and editor size to the content. */
function measure(text: string): { width: number; lines: string[] } {
  const lines = text.split("\n");
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  return { width: Math.max(40, longest * FONT_SIZE * 0.6), lines };
}

/**
 * In-place text editor for a note (existing or draft): a `foreignObject`
 * textarea. Enter commits, Shift+Enter inserts a newline, Escape cancels, and
 * blur commits. A `settled` guard makes commit/cancel fire exactly once so the
 * blur that fires as the editor unmounts can't override an Escape.
 */
function NoteEditor({
  x,
  y,
  initialText,
  onCommit,
  onCancel,
}: {
  x: number;
  y: number;
  initialText: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initialText);
  const settled = useRef(false);
  const once = (fn: () => void) => {
    if (settled.current) return;
    settled.current = true;
    fn();
  };
  const { width, lines } = measure(draft);
  const boxH = Math.max(1, lines.length) * LINE_HEIGHT + PADDING * 2;
  const boxW = width + PADDING * 2;

  return (
    <foreignObject x={x} y={y} width={boxW + 40} height={boxH + 20}>
      <textarea
        autoFocus
        aria-label="Annotation text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => once(() => onCommit(draft.trim()))}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            once(onCancel);
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            once(() => onCommit(draft.trim()));
          }
        }}
        style={{
          width: boxW,
          height: boxH,
          font: `${FONT_SIZE}px sans-serif`,
          lineHeight: `${LINE_HEIGHT}px`,
          padding: PADDING,
          resize: "none",
          outline: "2px solid #2563eb",
          borderRadius: 4,
          border: "none",
        }}
      />
    </foreignObject>
  );
}

/**
 * Renders a sheet's text annotations. With editor handlers each note is
 * draggable (pointer-capture, scale-aware), double-click edits it in place, and
 * a selected note shows a delete affordance; double-clicking empty canvas opens
 * a `draftAt` editor that creates a note on commit. Without handlers it renders
 * plain text — which is what PNG/PDF export walks.
 */
export function AnnotationLayer({
  annotations,
  selectedId = null,
  scale = 1,
  onSelect,
  onMove,
  onEdit,
  onDelete,
  draftAt = null,
  onCreate,
  onCancelDraft,
}: AnnotationLayerProps) {
  const editable = Boolean(onMove || onEdit || onDelete);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Live drag offset (logical units) while a note is being dragged.
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const [dragPos, setDragPos] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const beginDrag = (e: React.PointerEvent, a: Annotation) => {
    if (!editable || editingId === a.id || e.button !== 0) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = {
      id: a.id,
      startX: e.clientX,
      startY: e.clientY,
      baseX: a.x_abs,
      baseY: a.y_abs,
    };
    onSelect?.(a.id);
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    setDragPos({
      id: d.id,
      x: Math.round(d.baseX + dx),
      y: Math.round(d.baseY + dy),
    });
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    setDragPos(null);
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      onMove?.(d.id, Math.round(d.baseX + dx), Math.round(d.baseY + dy));
    }
  };

  return (
    <g>
      {annotations.map((a) => {
        const pos =
          dragPos?.id === a.id
            ? { x: dragPos.x, y: dragPos.y }
            : { x: a.x_abs, y: a.y_abs };
        const isSelected = selectedId === a.id;
        const { width, lines } = measure(a.text);
        const boxH = Math.max(1, lines.length) * LINE_HEIGHT + PADDING * 2;
        const boxW = width + PADDING * 2;

        if (editingId === a.id) {
          return (
            <NoteEditor
              key={a.id}
              x={pos.x}
              y={pos.y}
              initialText={a.text}
              onCommit={(text) => {
                setEditingId(null);
                if (text === a.text) return;
                if (text === "") onDelete?.(a.id);
                else onEdit?.(a.id, text);
              }}
              onCancel={() => setEditingId(null)}
            />
          );
        }

        return (
          <g
            key={a.id}
            transform={`translate(${pos.x} ${pos.y})`}
            style={{ cursor: editable ? "move" : "default" }}
            onPointerDown={(e) => beginDrag(e, a)}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onClick={(e) => {
              if (!editable) return;
              e.stopPropagation();
              onSelect?.(a.id);
            }}
            onDoubleClick={(e) => {
              if (!editable) return;
              e.stopPropagation();
              setEditingId(a.id);
            }}
          >
            {isSelected ? (
              <rect
                x={-PADDING}
                y={-PADDING}
                width={boxW}
                height={boxH}
                rx={4}
                fill="none"
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            ) : null}
            <text
              x={0}
              y={FONT_SIZE}
              fontSize={FONT_SIZE}
              fontFamily="sans-serif"
              className="fill-foreground"
            >
              {lines.map((line, i) => (
                <tspan key={i} x={0} dy={i === 0 ? 0 : LINE_HEIGHT}>
                  {line === "" ? " " : line}
                </tspan>
              ))}
            </text>

            {isSelected && onDelete ? (
              <g
                transform={`translate(${boxW - PADDING} ${-PADDING})`}
                style={{ cursor: "pointer" }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(a.id);
                }}
              >
                <circle r={8} className="fill-surface stroke-border" />
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={12}
                  className="fill-muted"
                >
                  ×
                </text>
              </g>
            ) : null}
          </g>
        );
      })}

      {draftAt ? (
        <NoteEditor
          x={draftAt.x}
          y={draftAt.y}
          initialText=""
          onCommit={(text) => {
            if (text !== "") onCreate?.(text, draftAt.x, draftAt.y);
            onCancelDraft?.();
          }}
          onCancel={() => onCancelDraft?.()}
        />
      ) : null}
    </g>
  );
}
