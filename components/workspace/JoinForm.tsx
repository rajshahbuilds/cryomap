"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInvite, type JoinState } from "@/app/workspaces/actions";

const INITIAL: JoinState = {};

/** Join button for an invite link. The server action redeems + redirects. */
export function JoinForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInvite, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-transparent bg-foreground px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join workspace"}
      </button>

      {state.error ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-status-broken">
            {state.error}
          </p>
          <Link
            href="/fridges"
            className="inline-block text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
          >
            Go to your workspaces
          </Link>
        </div>
      ) : null}
    </form>
  );
}
