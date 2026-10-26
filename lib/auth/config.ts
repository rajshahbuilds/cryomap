/**
 * Shared auth routing constants and pure helpers.
 *
 * Kept free of Supabase/browser imports so it can be used from the Edge
 * middleware, Server Components, Route Handlers, and the browser alike.
 */

/** Public entry point where unauthenticated users can start Google sign-in. */
export const LOGIN_PATH = "/";

/** OAuth code-exchange endpoint (Supabase redirects the browser here). */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Where a freshly signed-in user lands. */
export const DEFAULT_AUTHED_REDIRECT = "/fridges";

/** Paths reachable without a session. */
const PUBLIC_EXACT = new Set<string>(["/", "/playground"]);
const PUBLIC_PREFIXES = ["/auth"];

/** True when a path may be visited without an authenticated session. */
export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Sanitize a post-login `next` target to a same-origin relative path,
 * guarding against open-redirect payloads (`//evil.com`, `https://evil`).
 * Falls back to {@link DEFAULT_AUTHED_REDIRECT}.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_AUTHED_REDIRECT,
): string {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  return next;
}
