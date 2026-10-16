import { RepositoryError } from "@/lib/repositories";

/**
 * Turn an unknown thrown value into a concise, user-facing message for a toast.
 *
 * Supabase/Postgrest failures reach us as {@link RepositoryError}; we surface
 * their message so a save never fails silently, but fall back to a friendly
 * line for opaque errors. The optional `context` prefixes the message (e.g.
 * "Couldn't check out").
 */
export function errorToMessage(error: unknown, context?: string): string {
  const detail = extractDetail(error);
  if (!context) return detail;
  return detail ? `${context}: ${detail}` : context;
}

function extractDetail(error: unknown): string {
  if (error instanceof RepositoryError) return cleanup(error.message);
  if (error instanceof Error) return cleanup(error.message);
  if (typeof error === "string") return cleanup(error);
  return "";
}

/** Network failures (fetch) throw a generic "Failed to fetch" — humanize it. */
function cleanup(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "";
  if (/failed to fetch|networkerror|load failed/i.test(trimmed)) {
    return "Network request failed — check your connection.";
  }
  return trimmed;
}
