import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AUTH_CALLBACK_PATH } from "./config";

/**
 * Kick off the Google OAuth (PKCE) flow from the browser. Supabase redirects
 * to Google and, on success, back to {@link AUTH_CALLBACK_PATH}, preserving the
 * optional `next` destination so the callback can forward the user there.
 *
 * Resolves only if the redirect could not be started; on success the browser
 * navigates away before this promise settles.
 */
export async function signInWithGoogle(next?: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();

  const callbackUrl = new URL(AUTH_CALLBACK_PATH, window.location.origin);
  if (next) callbackUrl.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error) throw error;
}
