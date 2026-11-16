import type { DiagramState } from "@/lib/types";
import {
  isSignalPort,
  normalizeSignalPorts,
  type SignalPortType,
} from "@/lib/types/signalPorts";
import { lineEndpointType } from "./lineEndpoints";

export interface SignalPort {
  id: string;
  fridgeId: string | null;
  sheetId: string | null;
  name: string;
  componentType: SignalPortType;
  lineId: string | null;
}

/** One terminal per line, plus standalone I/O ports across every sheet. No wires are created. */
export function signalPorts(state: DiagramState): SignalPort[] {
  const components = normalizeSignalPorts(state.components, state.lines);
  return [
    ...components
      .filter(isSignalPort)
      .filter((c) => !c.line_endpoint_id)
      .map((c) => ({
        id: c.id,
        fridgeId: c.fridge_id,
        sheetId: c.sheet_id,
        name: c.label?.trim() ?? "",
        componentType: c.component_type,
        lineId: null,
      })),
    ...state.lines.map((line) => ({
      id: components.find((c) => c.line_endpoint_id === line.id)?.id ?? line.id,
      fridgeId: line.fridge_id,
      sheetId: line.sheet_id,
      name: line.name.trim(),
      componentType: lineEndpointType(line),
      lineId: line.id,
    })),
  ];
}

export function matchingSignalPorts(
  state: DiagramState,
  componentId: string,
): SignalPort[] {
  const ports = signalPorts(state);
  const source = ports.find((port) => port.id === componentId);
  if (!source?.name || !source.fridgeId) return [];
  return ports.filter(
    (port) =>
      port.id !== source.id &&
      port.fridgeId === source.fridgeId &&
      port.name === source.name,
  );
}
