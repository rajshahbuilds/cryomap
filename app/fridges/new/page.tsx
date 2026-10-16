import type { Metadata } from "next";
import { FridgeForm } from "@/components/fridge/FridgeForm";

export const metadata: Metadata = {
  title: "New fridge · CryoMap",
};

/** New-fridge page. Route protection is enforced by the middleware. */
export default function NewFridgePage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        CryoMap
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
        New fridge
      </h1>
      <p className="mt-2 text-sm text-muted">
        Creates the fridge and seeds the standard stage stack (300K → Sample).
      </p>

      <div className="mt-8">
        <FridgeForm />
      </div>
    </main>
  );
}
