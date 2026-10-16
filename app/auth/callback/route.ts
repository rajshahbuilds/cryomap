import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LOGIN_PATH, safeRedirectPath } from "@/lib/auth/config";
import { ensureProfile } from "@/lib/auth/profile";

/**
 * OAuth redirect target. Supabase sends the browser here with a `?code=` after
 * the user authorizes Google; we exchange it for a session (cookies are written
 * by the SSR server client) and forward to the sanitized `next` destination.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Reconcile the profile from the latest Google metadata. Non-fatal: the
      // DB trigger already seeds the row, so a failure here must not block login.
      if (data.user) {
        try {
          await ensureProfile(supabase, data.user);
        } catch {
          // Swallow — profile sync is best-effort.
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Missing code or a failed exchange — bounce back to login with an error flag.
  const loginUrl = new URL(LOGIN_PATH, origin);
  loginUrl.searchParams.set("error", "auth");
  return NextResponse.redirect(loginUrl);
}
