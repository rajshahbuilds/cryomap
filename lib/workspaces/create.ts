import { workspaceCreateSchema } from "@/lib/types";

/** Result state surfaced by the create-workspace form (via `useActionState`). */
export interface WorkspaceFormState {
  error?: string;
}

/** Validate the create-workspace form payload against the canonical schema. */
export function parseWorkspaceForm(formData: FormData) {
  const value = formData.get("name");
  const name = typeof value === "string" ? value.trim() : "";
  return workspaceCreateSchema.safeParse({ name });
}
