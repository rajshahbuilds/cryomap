"use client";

import type { Snapshot } from "@/lib/types";
import { snapshotToState } from "@/lib/types";
import { assembleDiagram } from "@/lib/diagram/assemble";
import { DiagramCanvas } from "./DiagramCanvas";

/** Read-only preview of a version's snapshot, watermarked HISTORICAL. */
export function SnapshotPreview({
  snapshot,
  label,
}: {
  snapshot: Snapshot;
  label: string;
}) {
  const view = assembleDiagram(snapshotToState(snapshot));
  return (
    <div className="relative h-full w-full">
      <DiagramCanvas view={view} />
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-6">
        <span className="rounded-full border border-status-noisy/40 bg-status-noisy/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-status-noisy">
          Historical — {label}
        </span>
      </div>
    </div>
  );
}
