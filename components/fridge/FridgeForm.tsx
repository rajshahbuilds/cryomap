"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createFridge } from "@/app/fridges/actions";
import type { FridgeFormState } from "@/lib/fridges/create";

const INITIAL: FridgeFormState = {};

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-status-planned";

function Field({
  label,
  name,
  required = false,
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-status-broken"> *</span> : null}
      </span>
      <input name={name} required={required} className={fieldClass} />
    </label>
  );
}

/** New-fridge form. Validation is enforced server-side via the Zod schema. */
export function FridgeForm() {
  const [state, action, pending] = useActionState(createFridge, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <Field label="Name" name="name" required />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Vendor" name="vendor" />
        <Field label="Model" name="model" />
      </div>
      <Field label="Location" name="location" />
      <label className="block space-y-1">
        <span className="text-sm font-medium text-foreground">Description</span>
        <textarea name="description" rows={3} className={fieldClass} />
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
          {pending ? "Creating…" : "Create fridge"}
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
