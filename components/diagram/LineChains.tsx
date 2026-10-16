"use client";

import type { CustomComponentDef } from "@/lib/types";
import { hopLabel, type TracedChain } from "@/lib/diagram/trace";

interface LineChainsProps {
  /** The selected line's display name — the terminal of every chain. */
  lineName: string;
  /** Chains that terminate at this line (empty → nothing links here). */
  chains: TracedChain[];
  /** For labeling custom-component hops. */
  customDefById: Map<string, CustomComponentDef>;
  /** Jump to a hop's component on its sheet (switch tab, pan, select). */
  onJump: (componentId: string, sheetId: string | null) => void;
}

/**
 * The full signal chain driving a fridge line, shown under the line's
 * properties: the room-temp bench components, then the chain carried on down
 * through the fridge's temperature stages (the components riding this line, warm
 * → cold). Every hop is a button that navigates to that component on its sheet.
 * Bench hops render with an em dash instead of an arrow when the walk couldn't
 * orient them (a branch/cycle); the fridge trunk is always ordered.
 */
export function LineChains({
  lineName,
  chains,
  customDefById,
  onJump,
}: LineChainsProps) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Signal chains
      </h3>
      {chains.length === 0 ? (
        <p className="text-xs text-muted">
          No bench chain links to this line yet. Add a Fridge Port on a
          room-temp sheet and link it here.
        </p>
      ) : (
        chains.map((chain) => {
          // Bench hops (unoriented if the walk found a branch/cycle) flow into
          // the fridge trunk, which is inherently ordered warm → cold.
          const nodes = [
            ...chain.hops.map((c) => ({
              component: c,
              sheetId: chain.sheetId,
              arrow: chain.oriented,
            })),
            ...chain.fridge.map((c) => ({
              component: c,
              sheetId: c.sheet_id,
              arrow: true,
            })),
          ];
          return (
            <div
              key={chain.endpointId}
              className="flex flex-wrap items-center gap-1 text-xs"
            >
              {nodes.map((n, i) => (
                <span key={n.component.id} className="flex items-center gap-1">
                  {i > 0 ? (
                    <span className="text-muted">{n.arrow ? "→" : "—"}</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onJump(n.component.id, n.sheetId)}
                    className="rounded border border-border bg-surface px-1.5 py-0.5 text-foreground transition hover:bg-background"
                  >
                    {hopLabel(
                      n.component,
                      n.component.custom_def_id
                        ? customDefById.get(n.component.custom_def_id)?.name
                        : undefined,
                    )}
                  </button>
                </span>
              ))}
              {/* Bare line (no components riding it): the line badge stands in
                  as the chain's terminal so it doesn't dangle off an arrow. */}
              {chain.fridge.length === 0 ? (
                <span className="flex items-center gap-1">
                  {nodes.length > 0 ? (
                    <span className="text-muted">
                      {chain.oriented ? "→" : "—"}
                    </span>
                  ) : null}
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 font-medium text-foreground">
                    {lineName}
                  </span>
                </span>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
