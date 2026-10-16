/** Outcome of redeeming an invite — mirrors the `redeem_invite` RPC status. */
export type InviteStatus =
  | "joined"
  | "already_member"
  | "invalid"
  | "revoked"
  | "expired"
  | "unauthenticated";

export interface RedeemResult {
  status: InviteStatus;
  workspace_id?: string;
  workspace_name?: string;
}

/** Path a shareable invite link points at (prefix with the origin to share). */
export function invitePath(token: string): string {
  return `/join/${token}`;
}

/**
 * Pull the token out of a pasted invite — a full URL (`…/join/TOKEN`), a path
 * (`/join/TOKEN`), or a bare token. Returns null if nothing usable is found.
 */
export function parseInviteToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromPath = trimmed.match(/\/join\/([^/?#\s]+)/);
  if (fromPath) return fromPath[1];
  return /^[^/?#\s]+$/.test(trimmed) ? trimmed : null;
}

/** An unguessable, URL-safe invite token (144 bits of randomness). */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Did redemption grant access (newly joined, or already a member)? */
export function isJoinSuccess(status: InviteStatus): boolean {
  return status === "joined" || status === "already_member";
}

/** User-facing message for a redemption outcome (success cases redirect). */
export function inviteStatusMessage(status: InviteStatus): string {
  switch (status) {
    case "invalid":
      return "This invite link isn't valid.";
    case "revoked":
      return "This invite link has been revoked.";
    case "expired":
      return "This invite link has expired.";
    case "unauthenticated":
      return "Please sign in to join this workspace.";
    case "joined":
    case "already_member":
      return "You're in.";
  }
}
