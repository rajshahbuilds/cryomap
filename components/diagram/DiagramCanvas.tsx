"use client";

import type { DiagramView } from "@/lib/diagram/assemble";
import { stagesHeight } from "@/lib/diagram/stages";
import { useCanvas } from "@/lib/hooks/useCanvas";
import { Canvas } from "./Canvas";
import { AnnotationLayer } from "./AnnotationLayer";
import { ComponentSymbol } from "./ComponentSymbol";
import { LineColumns } from "./LineColumns";
import { StagesBands } from "./StagesBands";
import { WireJunctions, WireSegments } from "./WireSegment";

/** Read-only render of an assembled diagram view (live state or a snapshot). */
export function DiagramCanvas({ view }: { view: DiagramView }) {
  const controller = useCanvas();
  return (
    <Canvas
      controller={controller}
      background={<StagesBands stages={view.stages} />}
    >
      <LineColumns
        lines={view.lines}
        height={stagesHeight(view.stages) || undefined}
      />
      <WireSegments wires={view.wires} />
      {view.positioned.map(({ component, x, y }) => (
        <ComponentSymbol
          key={component.id}
          component={component}
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
      {/* Explicit connections on top so they're never hidden behind a symbol. */}
      <WireSegments wires={view.explicitWires} variant="explicit" />
      <WireJunctions points={view.junctions} />
      <AnnotationLayer annotations={view.annotations} />
    </Canvas>
  );
}
