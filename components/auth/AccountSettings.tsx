"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteAccount } from "@/app/account/actions";
import { useToast } from "@/components/toast/ToastProvider";

export interface SoleAdminWorkspace {
  id: string;
  name: string;
  /** Members other than the current user. */
  otherMembers: number;
  fridgeCount: number;
}

/** The word typed to confirm deletion. */
export const CONFIRM_WORD = "delete";

const btn =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-background disabled:opacity-50";
const field =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm outline-none focus:border-status-planned disabled:opacity-50";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function AccountSettings({
  email,
  hasWorkspace,
  soleAdminWorkspaces,
}: {
  email: string | null;
  hasWorkspace: boolean;
  soleAdminWorkspaces: SoleAdminWorkspace[];
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const shared = soleAdminWorkspaces.filter((w) => w.otherMembers > 0);
  const confirmed = typed.trim().toLowerCase() === CONFIRM_WORD;

  const onDelete = () =>
    startTransition(async () => {
      // Redirects to the public homepage on success; only errors come back.
      const result = await deleteAccount(soleAdminWorkspaces.map((w) => w.id));
      if (result?.error) toast.error(result.error);
    });

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          Account
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {email ?? "Your account"}
        </h1>
        <Link
          href={hasWorkspace ? "/fridges" : "/welcome"}
          className="mt-2 inline-block text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Back
        </Link>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-status-broken">
          Danger zone
        </h2>
        {confirming ? (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
            <p className="text-sm text-foreground">
              Permanently delete your CryoMap account? You&rsquo;ll be removed
              from every workspace. Diagrams you worked on in other
              people&rsquo;s workspaces stay with those workspaces. This
              can&rsquo;t be undone.
            </p>

            {soleAdminWorkspaces.length > 0 ? (
              <div
                role="alert"
                className="space-y-3 rounded-lg border border-status-broken bg-background p-3"
              >
                <p className="text-sm font-semibold text-status-broken">
                  You&rsquo;re the only admin of{" "}
                  {soleAdminWorkspaces.length === 1
                    ? "this workspace"
                    : "these workspaces"}
                  . {soleAdminWorkspaces.length === 1 ? "It" : "They"} will be
                  permanently deleted with your account.
                </p>
                <ul className="space-y-2">
                  {soleAdminWorkspaces.map((w) => (
                    <li
                      key={w.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-foreground">
                        <span className="font-semibold">{w.name}</span>
                        <span className="text-muted">
                          {" "}
                          ·{" "}
                          {w.otherMembers > 0
                            ? plural(w.otherMembers, "other member")
                            : "only you"}{" "}
                          · {plural(w.fridgeCount, "fridge")}
                        </span>
                      </span>
                      {w.otherMembers > 0 ? (
                        <Link
                          href={`/workspaces/${w.id}/settings`}
                          className="text-sm font-medium text-foreground underline underline-offset-4 hover:opacity-80"
                        >
                          Make someone else admin
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {shared.length > 0 ? (
                  <p className="text-sm text-foreground">
                    Other people use{" "}
                    {shared.length === 1 ? "this workspace" : "some of these"}.
                    To keep it for them, make another member an admin first,
                    then come back and delete your account.
                  </p>
                ) : null}
              </div>
            ) : null}

            <label className="block space-y-1 text-sm text-foreground">
              <span>
                Type{" "}
                <span className="font-mono font-semibold">{CONFIRM_WORD}</span>{" "}
                to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={pending}
                autoComplete="off"
                className={`${field} block w-full max-w-xs`}
              />
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pending || !confirmed}
                className="rounded-lg border border-transparent bg-status-broken px-3 py-1.5 text-sm font-medium text-surface shadow-sm transition hover:opacity-90 disabled:opacity-60"
                onClick={onDelete}
              >
                {soleAdminWorkspaces.length > 0
                  ? `Delete account and ${plural(soleAdminWorkspaces.length, "workspace")}`
                  : "Delete account"}
              </button>
              <button
                type="button"
                disabled={pending}
                className={btn}
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-sm text-muted">
              Permanently delete your account and remove you from every
              workspace.
            </p>
            <button
              type="button"
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-status-broken shadow-sm transition hover:bg-background"
              onClick={() => setConfirming(true)}
            >
              Delete account
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
