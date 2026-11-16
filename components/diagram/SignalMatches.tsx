"use client";

import type { DiagramState } from "@/lib/types";
import { matchingSignalPorts, signalPorts } from "@/lib/diagram/signals";
import { getComponentDefinition } from "@/lib/constants/componentLibrary";

export function SignalMatches({
  state,
  componentId,
  onJump,
}: {
  state: DiagramState;
  componentId: string;
  onJump: (componentId: string, sheetId: string | null) => void;
}) {
  const named = signalPorts(state).find(
    (port) => port.id === componentId,
  )?.name;
  const matches = matchingSignalPorts(state, componentId);
  return (
    <section
      aria-label="Same signal"
      className="space-y-2 border-t border-border pt-3"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Same signal
      </h3>
      <p className="text-xs text-muted">
        Matching names identify the same signal within this fridge. Wires are
        drawn separately.
      </p>
      {!named ? (
        <p className="text-xs text-muted">
          Name this port to identify its signal across pages.
        </p>
      ) : matches.length === 0 ? (
        <p className="text-xs text-muted">No other ports with this name.</p>
      ) : (
        <ul className="space-y-1">
          {matches.map((port) => (
            <li key={port.id}>
              <button
                type="button"
                onClick={() => onJump(port.id, port.sheetId)}
                className="rounded border border-border bg-surface px-2 py-1 text-left text-xs transition hover:bg-background"
              >
                {state.sheets.find((sheet) => sheet.id === port.sheetId)
                  ?.name ?? "Fridge wiring"}{" "}
                · {getComponentDefinition(port.componentType).label}:{" "}
                {port.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
