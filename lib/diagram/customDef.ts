import type {
  Component,
  CustomComponentDef,
  Port,
  PortSide,
} from "@/lib/types";

/** The editable shape of a custom component definition (no id/fridge). */
export interface CustomDefFormValues {
  name: string;
  width_px: number;
  height_px: number;
  ports: Port[];
  extra_field_keys: string[];
}

/** Pin numbers are definition metadata, independent of connection identifiers. */
export type NumberedPort = Port & { pin_number: number };

/** Give older definitions pin numbers without changing any wiring references. */
export function numberCustomPorts(ports: Port[]): NumberedPort[] {
  const valid = (n: number | undefined): n is number =>
    n != null && Number.isSafeInteger(n) && n > 0;
  const reserved = new Set(ports.map((p) => p.pin_number).filter(valid));
  const assigned = new Set<number>();
  let next = 1;
  return ports.map((port) => {
    if (valid(port.pin_number) && !assigned.has(port.pin_number)) {
      assigned.add(port.pin_number);
      return { ...port, pin_number: port.pin_number };
    }
    while (reserved.has(next) || assigned.has(next)) next++;
    const pin_number = next++;
    assigned.add(pin_number);
    return { ...port, pin_number };
  });
}

function nextPortIndex(ports: Port[], side: PortSide): number {
  return (
    Math.max(-1, ...ports.filter((p) => p.side === side).map((p) => p.index)) +
    1
  );
}

/** Add the next pin across the whole part, keeping remaining pins unchanged. */
export function addCustomPin(ports: NumberedPort[]): NumberedPort[] {
  return [
    ...ports,
    {
      side: "left",
      index: nextPortIndex(ports, "left"),
      pin_number: Math.max(0, ...ports.map((p) => p.pin_number)) + 1,
    },
  ];
}

/** Move a pin to another side without letting its connection id collide. */
export function moveCustomPin(
  ports: NumberedPort[],
  pinNumber: number,
  side: PortSide,
): NumberedPort[] {
  return ports.map((port) => {
    if (port.pin_number !== pinNumber || port.side === side) return port;
    const occupied = ports.some(
      (p) => p.side === side && p.index === port.index,
    );
    return {
      ...port,
      side,
      index: occupied ? nextPortIndex(ports, side) : port.index,
    };
  });
}

export interface ExtraFieldRow {
  key: string;
  value: string;
}

/**
 * The extra-field rows to show for a custom component instance: one per key on
 * its definition, filled from the instance's stored `extra_fields`.
 */
export function extraFieldRows(
  def: CustomComponentDef | null | undefined,
  extraFields: Record<string, string>,
): ExtraFieldRow[] {
  if (!def?.extra_field_keys) return [];
  return def.extra_field_keys.map((key) => ({
    key,
    value: extraFields[key] ?? "",
  }));
}

/** How many placed components reference a given custom definition. */
export function customDefUsageCount(
  components: Component[],
  defId: string,
): number {
  return components.filter((c) => c.custom_def_id === defId).length;
}

/** Seed the modal form from an existing definition. */
export function defToFormValues(def: CustomComponentDef): CustomDefFormValues {
  return {
    name: def.name,
    width_px: def.width_px,
    height_px: def.height_px,
    ports: def.ports,
    extra_field_keys: def.extra_field_keys ?? [],
  };
}
