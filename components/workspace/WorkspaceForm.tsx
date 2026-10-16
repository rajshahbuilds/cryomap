"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createWorkspace } from "@/app/workspaces/actions";
import type { WorkspaceFormState } from "@/lib/workspaces/create";

const INITIAL: WorkspaceFormState = {};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-status-planned";

/** New-workspace form. Validation is enforced server-side via the Zod schema. */
export function WorkspaceForm() {
  const [state, action, pending] = useActionState(createWorkspace, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-foreground">
          Workspace name<span className="text-status-broken"> *</span>
        </span>
        <input name="name" required className={fieldClass} />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-status-broken">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-transparent bg-foreground px-4 py-2 text-sm font-medium text-surface shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create workspace"}
        </button>
        <Link
          href="/fridges"
          className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-background"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
