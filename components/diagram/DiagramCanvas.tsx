"use client";

import { LINE_ENDPOINT_HEADER } from "@/lib/diagram/lineConnections";
import type { DiagramView } from "@/lib/diagram/assemble";
import { stagesHeight } from "@/lib/diagram/stages";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { Canvas } from "./Canvas";
import { AnnotationLayer } from "./AnnotationLayer";
import { ComponentSymbol } from "./ComponentSymbol";
import { LineColumns, LineEndpointCaption } from "./LineColumns";
import { StagesBands } from "./StagesBands";
import { WireJunctions, WireSegments } from "./WireSegment";

/** Read-only render of an assembled diagram view (live state or a snapshot). */
export function DiagramCanvas({ view }: { view: DiagramView }) {
  const controller = useCanvas({
    topInset: view.lines.length ? LINE_ENDPOINT_HEADER : 0,
  });
  return (
    <Canvas
      topInset={view.lines.length ? LINE_ENDPOINT_HEADER : 0}
      controller={controller}
      background={<StagesBands stages={view.stages} />}
    >
      <LineColumns
        lines={view.lines}
        showEndpoints={false}
        height={stagesHeight(view.stages) || undefined}
      />
      <WireSegments wires={view.lineWires} />
      <WireSegments wires={view.wires} />
      {view.positioned.map(({ component, x, y }) => (
        <ComponentSymbol
          key={component.id}
          component={component}
          showCaption={!component.line_endpoint_id}
          def={
            component.custom_def_id
              ? (view.customDefById.get(component.custom_def_id) ?? null)
              : null
          }
          x={x}
          y={y}
          orientation={view.orientation}
          linkedLineName={
            component.linked_line_id
              ? (view.lineNameById.get(component.linked_line_id) ?? null)
              : null
          }
        />
      ))}
      {view.positioned
        .filter((p) => p.component.line_endpoint_id)
        .map((p) => {
          const line = view.lines.find(
            (l) => l.id === p.component.line_endpoint_id,
          );
          return line ? (
            <LineEndpointCaption
              key={p.component.id}
              line={line}
              x={p.x}
              y={p.y}
            />
          ) : null;
        })}
      {/* Explicit connections on top so they're never hidden behind a symbol. */}
      <WireSegments wires={view.explicitWires} variant="explicit" />
      <WireJunctions points={view.junctions} />
      <AnnotationLayer annotations={view.annotations} />
    </Canvas>
  );
}
