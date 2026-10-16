"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  changeMemberRole,
  createInviteLink,
  deleteWorkspace,
  leaveWorkspace,
  removeMember,
  renameWorkspace,
  revokeInviteLink,
} from "@/app/workspaces/actions";
import { useToast } from "@/components/toast/ToastProvider";
import {
  WORKSPACE_ROLES,
  type WorkspaceMember,
  type WorkspaceRole,
} from "@/lib/types";
import { canManageMembers } from "@/lib/workspaces/permissions";
import { isLastAdmin } from "@/lib/workspaces/members";
import { invitePath } from "@/lib/workspaces/invites";

interface MemberRow {
  userId: string;
  name: string;
  role: WorkspaceRole;
  joinedAt: string;
}
interface InviteRow {
  id: string;
  token: string;
  role: WorkspaceRole;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const btn =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-background disabled:opacity-50";
const btnPrimary =
  "rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-sm font-medium text-surface shadow-sm transition hover:opacity-90 disabled:opacity-60";
const field =
  "rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground shadow-sm outline-none focus:border-status-planned disabled:opacity-50";

function isInviteActive(invite: InviteRow, now: number): boolean {
  if (invite.revokedAt) return false;
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= now)
    return false;
  return true;
}

export function WorkspaceSettings({
  workspaceId,
  workspaceName,
  myRole,
  currentUserId,
  members,
  invites,
  fridgeCount,
}: {
  workspaceId: string;
  workspaceName: string;
  myRole: WorkspaceRole;
  currentUserId: string;
  members: MemberRow[];
  invites: InviteRow[];
  fridgeCount: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(workspaceName);
  const [newRole, setNewRole] = useState<WorkspaceRole>("editor");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Captured once (calling Date.now() during render isn't pure).
  const [now] = useState(() => Date.now());

  const admin = canManageMembers(myRole);
  const asMembers: WorkspaceMember[] = members.map((m) => ({
    workspace_id: workspaceId,
    user_id: m.userId,
    role: m.role,
    created_at: m.joinedAt,
  }));

  /** Run a server action, toast its result, and refresh on success. */
  const run = (
    fn: () => Promise<{ error?: string }>,
    okMessage: string,
    after?: () => void,
  ) =>
    startTransition(async () => {
      const result = await fn();
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(okMessage);
        if (after) after();
        else router.refresh();
      }
    });

  const activeInvites = invites.filter((i) => isInviteActive(i, now));

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-muted">
          Workspace
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {workspaceName}
        </h1>
        <Link
          href="/fridges"
          className="mt-2 inline-block text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          ← Back to fridges
        </Link>
      </header>

      {admin ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Name</h2>
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${field} flex-1`}
            />
            <button
              type="button"
              disabled={
                pending || !name.trim() || name.trim() === workspaceName
              }
              className={btnPrimary}
              onClick={() => {
                const fd = new FormData();
                fd.set("name", name.trim());
                run(
                  () => renameWorkspace(workspaceId, fd),
                  "Workspace renamed.",
                );
              }}
            >
              Save
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Members</h2>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {members.map((m) => {
            const isMe = m.userId === currentUserId;
            const last = isLastAdmin(asMembers, m.userId);
            return (
              <li
                key={m.userId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-sm text-foreground">
                  {m.name}
                  {isMe ? <span className="text-muted"> (you)</span> : null}
                </span>
                <div className="flex items-center gap-2">
                  {admin ? (
                    <select
                      value={m.role}
                      disabled={pending || last}
                      title={
                        last ? "A workspace must keep at least one admin." : ""
                      }
                      className={field}
                      onChange={(e) =>
                        run(
                          () =>
                            changeMemberRole(
                              workspaceId,
                              m.userId,
                              e.target.value as WorkspaceRole,
                            ),
                          "Role updated.",
                        )
                      }
                    >
                      {WORKSPACE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm capitalize text-muted">
                      {m.role}
                    </span>
                  )}
                  {isMe ? (
                    <button
                      type="button"
                      disabled={pending || last}
                      title={
                        last ? "Promote another admin before leaving." : ""
                      }
                      className={btn}
                      onClick={() =>
                        run(
                          () => leaveWorkspace(workspaceId),
                          "Left workspace.",
                          () => router.push("/fridges"),
                        )
                      }
                    >
                      Leave
                    </button>
                  ) : admin ? (
                    <button
                      type="button"
                      disabled={pending || last}
                      className={btn}
                      onClick={() =>
                        run(
                          () => removeMember(workspaceId, m.userId),
                          "Member removed.",
                        )
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {admin ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Invite links
          </h2>
          <p className="text-sm text-muted">
            Anyone who opens a link and signs in joins as the chosen role.
          </p>
          <div className="flex items-center gap-2">
            <select
              value={newRole}
              disabled={pending}
              className={field}
              onChange={(e) => setNewRole(e.target.value as WorkspaceRole)}
            >
              {WORKSPACE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pending}
              className={btnPrimary}
              onClick={() =>
                startTransition(async () => {
                  const result = await createInviteLink(workspaceId, newRole);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success("Invite link created.");
                    router.refresh();
                  }
                })
              }
            >
              Create link
            </button>
          </div>

          {activeInvites.length === 0 ? (
            <p className="text-sm text-muted">No active invite links.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {activeInvites.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <span className="text-sm text-foreground">
                    <span className="capitalize">{i.role}</span>
                    {i.expiresAt ? (
                      <span className="text-muted">
                        {" "}
                        · expires {new Date(i.expiresAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={btn}
                      onClick={() => {
                        const url = `${window.location.origin}${invitePath(i.token)}`;
                        navigator.clipboard
                          .writeText(url)
                          .then(() => toast.success("Link copied."))
                          .catch(() => toast.error("Couldn’t copy the link."));
                      }}
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className={btn}
                      onClick={() =>
                        run(
                          () => revokeInviteLink(i.id),
                          "Invite link revoked.",
                        )
                      }
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {admin ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-status-broken">
            Danger zone
          </h2>
          {confirmingDelete ? (
            <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm text-foreground">
                Permanently delete{" "}
                <span className="font-semibold">{workspaceName}</span>
                {fridgeCount > 0
                  ? ` and its ${fridgeCount} fridge${fridgeCount === 1 ? "" : "s"}`
                  : ""}
                ? This can&rsquo;t be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg border border-transparent bg-status-broken px-3 py-1.5 text-sm font-medium text-surface shadow-sm transition hover:opacity-90 disabled:opacity-60"
                  onClick={() =>
                    run(
                      () => deleteWorkspace(workspaceId),
                      "Workspace deleted.",
                      () => router.push("/fridges"),
                    )
                  }
                >
                  Delete permanently
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className={btn}
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-sm text-muted">
                Delete this workspace and all of its fridges and diagrams.
              </p>
              <button
                type="button"
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-status-broken shadow-sm transition hover:bg-background"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete workspace
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
