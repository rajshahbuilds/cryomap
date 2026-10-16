"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "./config";

/**
 * Server action: clear the Supabase session (and its auth cookies) and return
 * the user to the public homepage. Wire it to a `<form action={signOut}>`.
 */
export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(LOGIN_PATH);
}
