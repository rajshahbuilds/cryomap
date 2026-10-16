import type {
  BuiltInComponentType,
  Component,
  CustomComponentDef,
  Port,
  Rotation,
} from "@/lib/types";
import type { Size } from "./camera";
import { COMPONENT_LIBRARY } from "@/lib/constants/componentLibrary";

/** Size for a custom component whose definition couldn't be resolved. */
export const CUSTOM_FALLBACK_SIZE: Size = { width: 80, height: 40 };

/**
 * Length of the lead stubs that custom-component ports stick out of the box,
 * matching the inset built-in glyphs draw their leads with (see `LeadsLR`), so
 * custom components wire up with the same visual affordance.
 */
export const CUSTOM_PORT_LEAD = 10;

/**
 * How far a component's ports sit outside its box. Custom boxes extend ports
 * outward on a lead stub; built-in glyphs draw their leads inward, so their
 * ports stay on the box edge (`0`).
 */
export function componentPortLead(component: Component): number {
  return component.component_type === "custom" ? CUSTOM_PORT_LEAD : 0;
}

/** A component's symbol size: from its custom def, or the built-in library. */
export function componentSize(
  component: Component,
  def?: CustomComponentDef | null,
): Size {
  if (component.component_type === "custom") {
    return def
      ? { width: def.width_px, height: def.height_px }
      : CUSTOM_FALLBACK_SIZE;
  }
  return COMPONENT_LIBRARY[component.component_type].defaultSize;
}

/** A component's ports: from its custom def, or the built-in library. */
export function componentPorts(
  component: Component,
  def?: CustomComponentDef | null,
): Port[] {
  if (component.component_type === "custom") return def?.ports ?? [];
  return COMPONENT_LIBRARY[component.component_type].ports;
}

/**
 * The signal-flow direction of the sheet a component sits on. A fridge sheet
 * flows top-to-bottom down the temperature stages (`vertical`); a room-temp
 * bench sheet flows left-to-right (`horizontal`). Derived from the sheet, not
 * stored on the component — see `sheetOrientation`.
 */
export type FlowOrientation = "vertical" | "horizontal";

/**
 * A quarter-turn applied so a built-in's inline ports face along the sheet's
 * flow. A component is "inline" when all its ports sit on one
 * axis: an attenuator's are left/right, so on a *vertical* fridge sheet it is
 * turned 90° to face top/bottom; on a *horizontal* bench sheet it needs no turn.
 * A component whose ports are all top/bottom is the mirror case.
 *
 * This is a *display* rotation derived from the type and the sheet, on top of
 * the instance's own rotation — stored port sides are untouched, so existing
 * port-to-port connections still resolve (they just anchor at the new
 * positions). Mixed-axis built-ins (circulator, coupler) and custom components,
 * whose authors placed the ports deliberately, are never auto-turned.
 */
export function baseRotationForType(
  type: BuiltInComponentType,
  orientation: FlowOrientation = "vertical",
): Rotation {
  const ports = COMPONENT_LIBRARY[type].ports;
  if (ports.length === 0) return 0;
  const onAxis = (a: Port["side"], b: Port["side"]) =>
    ports.every((p) => p.side === a || p.side === b);
  // Turn an inline component onto the sheet's flow axis: left/right ports need
  // the turn on a vertical sheet, top/bottom ports on a horizontal one.
  return orientation === "vertical"
    ? onAxis("left", "right")
      ? 90
      : 0
    : onAxis("top", "bottom")
      ? 90
      : 0;
}

export function componentBaseRotation(
  component: Component,
  orientation: FlowOrientation = "vertical",
): Rotation {
  if (component.component_type === "custom") return 0;
  return baseRotationForType(component.component_type, orientation);
}

/** A component's on-canvas rotation: its stored rotation plus any base turn. */
export function effectiveRotation(
  component: Component,
  orientation: FlowOrientation = "vertical",
): Rotation {
  return ((component.rotation + componentBaseRotation(component, orientation)) %
    360) as Rotation;
}
