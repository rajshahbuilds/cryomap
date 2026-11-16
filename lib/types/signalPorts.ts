import type { Component, Line } from "./rows";

export type SignalPortType = "input_port" | "output_port" | "bidir_port";

/** The three placeable signal terminals. Names are exact, case-sensitive signal IDs. */
export function isSignalPort<T extends Pick<Component, "component_type">>(
  component: T,
): component is T & {
  component_type: SignalPortType;
} {
  return ["input_port", "output_port", "bidir_port"].includes(
    component.component_type,
  );
}

/** Read old diagrams as ordinary named input ports without changing physical wiring.
 * The deprecated discriminator and FK remain readable for historical snapshots.
 */
export function normalizeSignalPorts(
  components: Component[],
  lines: Line[],
): Component[] {
  return components.map((component) => {
    if (component.component_type !== "fridge_port") return component;
    const line = lines.find(
      (line) =>
        line.id === component.linked_line_id &&
        line.fridge_id === component.fridge_id,
    );
    return {
      ...component,
      component_type: "input_port",
      label: line?.name ?? component.label,
      linked_line_id: null,
    };
  });
}
