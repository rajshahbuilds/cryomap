import type { Component, ComponentType } from "@/lib/types";
import { componentsRepo, type Db } from "@/lib/repositories";
import { COMPONENT_LIBRARY } from "@/lib/constants/componentLibrary";
import { targetToPosition, type PlacementTarget } from "./placement";

export interface PlaceComponentInput {
  fridgeId: string;
  /** The sheet being edited. A component always belongs to exactly one. */
  sheetId: string;
  componentType: ComponentType;
  customDefId?: string | null;
  /** Where it lands: a stage band (pinned) or white space (free). */
  target: PlacementTarget;
}

/**
 * Create a component at a resolved placement target, applying the built-in
 * type's default fields (custom components carry none).
 */
export async function createPlacedComponent(
  db: Db,
  input: PlaceComponentInput,
): Promise<Component> {
  const defaults =
    input.componentType === "custom"
      ? {}
      : COMPONENT_LIBRARY[input.componentType].defaultFields;

  return componentsRepo(db).create({
    fridge_id: input.fridgeId,
    sheet_id: input.sheetId,
    component_type: input.componentType,
    custom_def_id: input.customDefId ?? null,
    label: defaults.label ?? null,
    value: defaults.value ?? null,
    ...targetToPosition(input.target),
  });
}
