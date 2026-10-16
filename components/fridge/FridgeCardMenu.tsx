"use client";

import { useRef } from "react";
import type { Fridge } from "@/lib/types";
import {
  deleteFridge,
  duplicateFridge,
  renameFridge,
  setArchived,
} from "@/app/fridges/actions";

const itemClass =
  "block w-full rounded-md px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-background";

/** Overflow menu for a fridge card: rename, archive/unarchive, duplicate, delete. */
export function FridgeCardMenu({ fridge }: { fridge: Fridge }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const rename = renameFridge.bind(null, fridge.id);
  const archive = setArchived.bind(null, fridge.id, !fridge.archived);
  const duplicate = duplicateFridge.bind(null, fridge.id);
  const remove = deleteFridge.bind(null, fridge.id);

  const closeMenu = () => detailsRef.current?.removeAttribute("open");

  return (
    <>
      <details ref={detailsRef} className="relative">
        <summary
          aria-label={`Actions for ${fridge.name}`}
          className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-md text-muted transition hover:bg-background [&::-webkit-details-marker]:hidden"
        >
          ⋯
        </summary>
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-border bg-surface p-1 shadow-md">
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              closeMenu();
              dialogRef.current?.showModal();
            }}
          >
            Rename
          </button>
          <form action={archive} onSubmit={closeMenu}>
            <button type="submit" className={itemClass}>
              {fridge.archived ? "Unarchive" : "Archive"}
            </button>
          </form>
          <form action={duplicate} onSubmit={closeMenu}>
            <button type="submit" className={itemClass}>
              Duplicate
            </button>
          </form>
          <button
            type="button"
            className={`${itemClass} text-status-broken`}
            onClick={() => {
              closeMenu();
              deleteRef.current?.showModal();
            }}
          >
            Delete
          </button>
        </div>
      </details>

      <dialog
        ref={dialogRef}
        className="rounded-xl border border-border p-0 shadow-lg backdrop:bg-black/30"
      >
        <form
          action={rename}
          onSubmit={() => dialogRef.current?.close()}
          className="w-80 space-y-3 p-5"
        >
          <h2 className="text-base font-semibold text-foreground">
            Rename fridge
          </h2>
          <input
            name="name"
            defaultValue={fridge.name}
            required
            aria-label="Fridge name"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-status-planned"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg border border-transparent bg-foreground px-3 py-1.5 text-sm font-medium text-surface transition hover:opacity-90"
            >
              Save
            </button>
          </div>
        </form>
      </dialog>

      <dialog
        ref={deleteRef}
        className="rounded-xl border border-border p-0 shadow-lg backdrop:bg-black/30"
      >
        <form
          action={remove}
          onSubmit={() => deleteRef.current?.close()}
          className="w-80 space-y-3 p-5"
        >
          <h2 className="text-base font-semibold text-foreground">
            Delete fridge
          </h2>
          <p className="text-sm text-muted">
            Permanently delete{" "}
            <span className="font-medium text-foreground">{fridge.name}</span>{" "}
            and its entire diagram? This can&rsquo;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => deleteRef.current?.close()}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-background"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg border border-transparent bg-status-broken px-3 py-1.5 text-sm font-medium text-surface transition hover:opacity-90"
            >
              Delete
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
