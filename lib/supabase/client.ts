import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";
import { requireSupabaseEnv } from "./env";

/** Supabase client for use in Client Components / the browser. */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
