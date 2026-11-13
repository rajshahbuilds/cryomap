import { z } from "zod";
import { wireConstructionSchema } from "./enums";

const lengthSchema = z
  .object({
    value: z.number().positive(),
    unit: z.enum(["m", "cm", "mm"]),
  })
  .strict();

const sizeSchema = z
  .object({
    value: z.number(),
    unit: z.enum(["awg", "mm", "um"]),
  })
  .strict()
  .refine(
    ({ value, unit }) =>
      unit === "awg" ? Number.isInteger(value) && value >= -3 : value > 0,
    "AWG must be an integer of -3 or greater; diameters must be positive.",
  );

/** Shared, versionable payload on explicit and automatically generated wires. */
export const wirePropertiesSchema = z
  .object({
    construction: wireConstructionSchema.default("unspecified"),
    label: z.string().nullable().default(null),
    show_label: z.boolean().default(false),
    material: z.string().nullable().default(null),
    inner_shield_material: z.string().nullable().default(null),
    outer_shield_material: z.string().nullable().default(null),
    length: lengthSchema.nullable().default(null),
    size: sizeSchema.nullable().default(null),
    conductor_count: z
      .number()
      .int()
      .positive()
      .max(2147483647)
      .nullable()
      .default(null),
    notes: z.string().nullable().default(null),
  })
  .strict();
export type WireProperties = z.infer<typeof wirePropertiesSchema>;
export const DEFAULT_WIRE_PROPERTIES: WireProperties =
  wirePropertiesSchema.parse({});

/** Stable identity, independent of which endpoint is visually above the other. */
export function wireSegmentEndpoints(a: string, b: string) {
  const [from_component_id, to_component_id] = [
    a.toLowerCase(),
    b.toLowerCase(),
  ].sort();
  return { from_component_id, to_component_id };
}
