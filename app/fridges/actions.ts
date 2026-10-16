"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/config";
import {
  createFridge as createFridgeRecord,
  parseFridgeForm,
  type FridgeFormState,
} from "@/lib/fridges/create";
import { duplicateFridge as duplicateFridgeService } from "@/lib/fridges/duplicate";
import { fridgesRepo } from "@/lib/repositories";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadActiveWorkspace } from "@/lib/workspaces/loadActive";

async function requireSession() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(LOGIN_PATH);
  return { db, userId: user.id };
}

/** Create a fridge (no stages — the user adds them in the editor). */
export async function createFridge(
  _prev: FridgeFormState,
  formData: FormData,
): Promise<FridgeFormState> {
  const parsed = parseFridgeForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { db, userId } = await requireSession();
  const { active } = await loadActiveWorkspace(db);
  if (!active) {
    return { error: "Create a workspace before adding a fridge." };
  }
  try {
    await createFridgeRecord(
      db,
      { ...parsed.data, workspace_id: active.id },
      userId,
    );
  } catch {
    return { error: "Could not create the fridge. Please try again." };
  }

  revalidatePath("/fridges");
  redirect("/fridges");
}

/** Rename a fridge (bind the id; name comes from the form). */
export async function renameFridge(
  id: string,
  formData: FormData,
): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const db = await createSupabaseServerClient();
  await fridgesRepo(db).update(id, { name });
  revalidatePath("/fridges");
}

/** Archive or unarchive a fridge (bind the id + target state). */
export async function setArchived(
  id: string,
  archived: boolean,
): Promise<void> {
  const db = await createSupabaseServerClient();
  await fridgesRepo(db).update(id, { archived });
  revalidatePath("/fridges");
}

/** Permanently delete a fridge and its diagram (editor+ via RLS; cascades). */
export async function deleteFridge(id: string): Promise<void> {
  const db = await createSupabaseServerClient();
  await fridgesRepo(db).delete(id);
  revalidatePath("/fridges");
}

/** Duplicate a fridge and its full diagram into an independent copy. */
export async function duplicateFridge(id: string): Promise<void> {
  const { db, userId } = await requireSession();
  await duplicateFridgeService(db, id, userId);
  revalidatePath("/fridges");
}
