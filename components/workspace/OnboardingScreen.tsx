"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { invitePath, parseInviteToken } from "@/lib/workspaces/invites";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-status-planned";

/**
 * First-run screen for a user with no workspace: create one, or join an
 * existing one with an invite link.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);

  const join = () => {
    const token = parseInviteToken(link);
    if (!token) {
      setError("Paste a valid invite link.");
      return;
    }
    router.push(invitePath(token));
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          Create a workspace
        </h2>
        <p className="mt-1 text-sm text-muted">
          Start a new lab. You&rsquo;ll be its admin and can invite others.
        </p>
        <Link
          href="/workspaces/new"
          className="mt-4 inline-block rounded-lg border border-transparent bg-foreground px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:opacity-90"
        >
          Create workspace
        </Link>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-foreground">
          Join with an invite link
        </h2>
        <p className="mt-1 text-sm text-muted">
          Paste a link a workspace admin shared with you.
        </p>
        <div className="mt-4 space-y-2">
          <input
            value={link}
            onChange={(e) => {
              setLink(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") join();
            }}
            placeholder="https://…/join/…"
            className={fieldClass}
          />
          {error ? (
            <p role="alert" className="text-sm text-status-broken">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={join}
            disabled={!link.trim()}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-background disabled:opacity-50"
          >
            Join workspace
          </button>
        </div>
      </section>
    </div>
  );
}
