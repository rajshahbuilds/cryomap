import type { ComponentPosition } from "./componentService";
import type { DiagramState } from "@/lib/types";

/** Patch one component's position in the browser copy of the diagram. */
export function withComponentPosition(
  state: DiagramState,
  id: string,
  position: ComponentPosition,
): DiagramState {
  return {
    ...state,
    components: state.components.map((component) =>
      component.id === id ? { ...component, ...position } : component,
    ),
  };
}

/**
 * Remove components and their incident explicit connections from the browser
 * copy. The database applies the same connection cleanup through its foreign
 * keys when the component rows are deleted.
 */
export function withoutComponents(
  state: DiagramState,
  componentIds: Iterable<string>,
): DiagramState {
  const removed = new Set(componentIds);
  return {
    ...state,
    components: state.components.filter(
      (component) => !removed.has(component.id),
    ),
    connections: state.connections.filter(
      (connection) =>
        !removed.has(connection.from_component_id) &&
        !removed.has(connection.to_component_id),
    ),
  };
}

/** Remove one explicit connection from the browser copy. */
export function withoutConnection(
  state: DiagramState,
  connectionId: string,
): DiagramState {
  return {
    ...state,
    connections: state.connections.filter(
      (connection) => connection.id !== connectionId,
    ),
  };
}
