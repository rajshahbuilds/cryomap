import type { LineType } from "@/lib/types";

/**
 * Per-line-type display metadata. The `color` is the trunk-line color drawn on
 * the canvas; each line type gets a distinct color.
 */
export interface LineTypeMeta {
  label: string;
  color: string;
}

export const LINE_TYPE_META: Record<LineType, LineTypeMeta> = {
  microwave_input: { label: "Microwave In", color: "#2563eb" },
  microwave_output: { label: "Microwave Out", color: "#7c3aed" },
  readout_input: { label: "Readout In", color: "#0891b2" },
  readout_output: { label: "Readout Out", color: "#0d9488" },
  xy_drive: { label: "XY Drive", color: "#16a34a" },
  flux_z: { label: "Flux / Z", color: "#ca8a04" },
  dc_bias: { label: "DC Bias", color: "#d97706" },
  pump: { label: "Pump", color: "#db2777" },
  thermometry: { label: "Thermometry", color: "#dc2626" },
  heater: { label: "Heater", color: "#ea580c" },
  ground: { label: "Ground", color: "#6b7280" },
  custom: { label: "Custom", color: "#475569" },
};

export function getLineTypeColor(type: LineType): string {
  return LINE_TYPE_META[type].color;
}

export function getLineTypeLabel(type: LineType): string {
  return LINE_TYPE_META[type].label;
}
