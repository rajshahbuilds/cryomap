import type { Metadata } from "next";
import Link from "next/link";
import { Snowflake } from "lucide-react";
import { DemoDiagramEditor } from "@/components/diagram/DemoDiagramEditor";

export const metadata: Metadata = {
  title: "Try the CryoMap editor",
  description:
    "Explore CryoMap's dilution-refrigerator wiring editor without creating an account.",
  alternates: { canonical: "/playground" },
};

export default function PlaygroundPage() {
  return (
    <div className="flex h-screen min-h-[38rem] flex-col bg-background">
      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4">
        <Link
          href="/"
          aria-label="CryoMap home"
          className="flex items-center gap-2.5 font-semibold tracking-tight text-ice-deep"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-ice-deep via-ice to-ice-frost text-white">
            <Snowflake aria-hidden="true" size={17} strokeWidth={2.2} />
          </span>
          CryoMap
        </Link>

        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">Live demo</p>
          <p className="text-xs text-muted">
            Temporary session · Nothing is saved
          </p>
        </div>
      </header>

      <main className="relative min-h-0 flex-1">
        <DemoDiagramEditor />
      </main>
    </div>
  );
}
