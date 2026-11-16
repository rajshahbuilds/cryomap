"use client";

import type { Component, CustomComponentDef, Port } from "@/lib/types";
import {
  componentPorts,
  effectiveRotation,
} from "@/lib/diagram/componentGeometry";
import { effectiveSide } from "@/lib/diagram/ports";
import {
  lineConnectionPorts,
  portIdentity,
} from "@/lib/diagram/lineConnections";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Choices are local port identities, so rotating or mirroring preserves wiring. */
export function ComponentLinePorts({
  component,
  def,
  readOnly,
  onSave,
}: {
  component: Component;
  def: CustomComponentDef | null;
  readOnly: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const ports = componentPorts(component, def);
  const resolved = {
    entry: lineConnectionPorts({ ...component, line_entry_port: null }, def)
      .entry,
    exit: lineConnectionPorts({ ...component, line_exit_port: null }, def).exit,
  };
  const rotation = effectiveRotation(component, "vertical");
  const label = (port: Port) =>
    `${cap(port.side)} ${port.index + 1} (${effectiveSide(port.side, rotation, component.mirrored)})`;
  return (
    <fieldset
      disabled={readOnly}
      className="space-y-3 border-t border-border pt-3"
    >
      <legend className="text-xs font-semibold text-muted">
        Line connections
      </legend>
      {(
        [
          ["line_entry_port", "Connection above", resolved.entry],
          ["line_exit_port", "Connection below", resolved.exit],
        ] as const
      ).map(([key, title, automatic]) => (
        <label key={key} className="block space-y-1 text-xs text-muted">
          <span>{title}</span>
          <select
            aria-label={title}
            className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-foreground disabled:opacity-60"
            defaultValue={component[key] ? portIdentity(component[key]) : ""}
            onChange={(e) => {
              const port =
                ports.find((p) => portIdentity(p) === e.target.value) ?? null;
              onSave({ [key]: port });
            }}
          >
            <option value="">
              Automatic{automatic ? `: ${label(automatic)}` : ": no connection"}
            </option>
            {component[key] &&
            !ports.some(
              (port) => portIdentity(port) === portIdentity(component[key]!),
            ) ? (
              <option value={portIdentity(component[key])} disabled>
                Unavailable: {label(component[key])}
              </option>
            ) : null}
            {ports.map((port) => (
              <option
                key={portIdentity(port)}
                value={portIdentity(port)}
                disabled={
                  portIdentity(port) ===
                  (component[
                    key === "line_entry_port"
                      ? "line_exit_port"
                      : "line_entry_port"
                  ]
                    ? portIdentity(
                        component[
                          key === "line_entry_port"
                            ? "line_exit_port"
                            : "line_entry_port"
                        ]!,
                      )
                    : "")
                }
              >
                {label(port)}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p className="text-xs text-muted">
        Above and below describe position, independent of signal direction.
        {ports.length > 2
          ? " Choose the two ports that carry this line; branches use explicit wires."
          : " A single-port device ends the chain."}
      </p>
    </fieldset>
  );
}
