import type { Component, CustomComponentDef, Port } from "@/lib/types";
import { componentPorts, effectiveRotation } from "./componentGeometry";
import { effectiveSide } from "./ports";

/** The sheet boundary is above the first component, independent of signal flow. */
export const LINE_ENDPOINT_Y = -16;
/** Header space above stages; stored component positions stay unchanged. */
export const LINE_ENDPOINT_HEADER = 80;
export const portIdentity = (port: Port) => `${port.side}:${port.index}`;

/**
 * Only simple inline components are inferred. Branch devices require a port
 * choice; rotation never silently changes an explicitly selected local port.
 * A single-port device terminates the chain instead of passing it through.
 */
export function lineConnectionPorts(
  component: Component,
  def?: CustomComponentDef | null,
): { entry: Port | null; exit: Port | null } {
  const ports = componentPorts(component, def);
  const rotation = effectiveRotation(component, "vertical");
  const facing = (side: "top" | "bottom") => {
    const candidates = ports.filter(
      (port) => effectiveSide(port.side, rotation, component.mirrored) === side,
    );
    return candidates.length === 1 ? candidates[0] : null;
  };
  const chosen = (port: Port | null | undefined) =>
    port
      ? (ports.find((p) => portIdentity(p) === portIdentity(port)) ?? null)
      : null;
  let entry = component.line_entry_port
    ? chosen(component.line_entry_port)
    : ports.length === 1
      ? ports[0]
      : ports.length === 2
        ? facing("top")
        : null;
  let exit = component.line_exit_port
    ? chosen(component.line_exit_port)
    : ports.length === 2
      ? facing("bottom")
      : null;
  if (entry && exit && portIdentity(entry) === portIdentity(exit)) {
    if (component.line_exit_port && !component.line_entry_port) entry = null;
    else exit = null;
  }
  return { entry, exit };
}
