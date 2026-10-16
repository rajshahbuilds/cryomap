import type { Fridge, FridgeCreateInput } from "@/lib/types";
import { fridgeCreateSchema } from "@/lib/types";
import { fridgesRepo, type Db } from "@/lib/repositories";

/** Result state surfaced by the create form (via `useActionState`). */
export interface FridgeFormState {
  error?: string;
}

/** Read a trimmed, non-empty string field from a form, or `undefined`. */
function field(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Validate the fridge form payload against the canonical Zod schema. */
export function parseFridgeForm(formData: FormData) {
  return fridgeCreateSchema.safeParse({
    name: field(formData, "name"),
    vendor: field(formData, "vendor"),
    model: field(formData, "model"),
    description: field(formData, "description"),
    location: field(formData, "location"),
  });
}

/**
 * Create a fridge. New fridges start with no stages — users add the temperature
 * stages they actually need via the editor's "Add stage" control.
 */
export async function createFridge(
  db: Db,
  input: FridgeCreateInput,
  createdBy?: string,
): Promise<Fridge> {
  return fridgesRepo(db).create(input, createdBy);
}
