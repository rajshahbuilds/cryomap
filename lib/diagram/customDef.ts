import type { Component, CustomComponentDef, Port } from "@/lib/types";

/** The editable shape of a custom component definition (no id/fridge). */
export interface CustomDefFormValues {
  name: string;
  width_px: number;
  height_px: number;
  ports: Port[];
  extra_field_keys: string[];
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
