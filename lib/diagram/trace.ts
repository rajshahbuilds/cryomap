import type { Component, DiagramState } from "@/lib/types";
import { COMPONENT_LIBRARY } from "@/lib/constants/componentLibrary";
import { assembleDiagram, type DiagramView } from "@/lib/diagram/assemble";

/**
 * A bench signal chain that drives a fridge line: the room-temperature
 * components wired to a `fridge_port`, in signal order, plus the fridge line the
 * port links to. Produced by walking the (undirected) connection graph outward
 * from the port.
 */
export interface TracedChain {
  /** The `fridge_port` component the walk started from. */
  endpointId: string;
  /** The fridge line this endpoint links to (`null` if it links to nothing). */
  lineId: string | null;
  /** The room-temp sheet the chain lives on. */
  sheetId: string | null;
  /**
   * Bench components in signal order — source first, ending at the component
   * wired into the port. Excludes the port itself (the line stands in for it).
   */
  hops: Component[];
  /**
   * The fridge-side continuation: components riding the linked trunk line, warm
   * (top stage) → cold (bottom stage) — the chain carried on down through the
   * temperature stages. Empty when the port links to nothing or the line is bare.
   */
  fridge: Component[];
  /**
   * True when the reachable subgraph is a simple path (no branch, no cycle), so
   * rendering it with directional arrows is meaningful. A fan-out/fan-in or a
   * cycle sets this false — the chain is still listed, just unoriented.
   */
  oriented: boolean;
}

/** Undirected adjacency (component id → connected component ids) for a sheet. */
function adjacency(view: DiagramView): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return; // ignore self-loops
    (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
  };
  for (const c of view.connections) {
    link(c.from_component_id, c.to_component_id);
    link(c.to_component_id, c.from_component_id);
  }
  return adj;
}

/**
 * Undirected walk of the connection graph from an endpoint, in signal order.
 * BFS with a visited set (so a cycle terminates), ordered outward from the
 * endpoint, then reversed so the farthest component (the signal source) leads.
 */
export function traceChain(
  view: DiagramView,
  start: { componentId: string },
): TracedChain {
  const byId = new Map(view.components.map((c) => [c.id, c]));
  const endpoint = byId.get(start.componentId) ?? null;
  const base: TracedChain = {
    endpointId: start.componentId,
    lineId: endpoint?.linked_line_id ?? null,
    sheetId: endpoint?.sheet_id ?? null,
    hops: [],
    fridge: [],
    oriented: true,
  };
  if (!endpoint) return base;

  const adj = adjacency(view);

  // BFS outward, recording each node's distance from the endpoint.
  const distance = new Map<string, number>([[endpoint.id, 0]]);
  const queue = [endpoint.id];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    const d = distance.get(id)!;
    for (const next of adj.get(id) ?? []) {
      if (distance.has(next)) continue;
      distance.set(next, d + 1);
      queue.push(next);
    }
  }

  // Simple path ⇔ tree (edges === nodes − 1) with no node of degree > 2.
  const nodes = distance.size;
  let degreeSum = 0;
  let maxDegree = 0;
  for (const id of distance.keys()) {
    const deg = adj.get(id)?.size ?? 0;
    degreeSum += deg;
    maxDegree = Math.max(maxDegree, deg);
  }
  const edges = degreeSum / 2;
  const oriented = maxDegree <= 2 && edges === nodes - 1;

  // Signal order: farthest (source) first, ending at the port's neighbour. The
  // port itself is dropped — the linked line stands in for it. `queue` is BFS
  // order (near→far); sort by distance descending is stable, keeping that order
  // within a rank.
  const hops = queue
    .filter((id) => id !== endpoint.id)
    .map((id) => ({ id, d: distance.get(id)! }))
    .sort((a, b) => b.d - a.d)
    .map(({ id }) => byId.get(id)!)
    .filter(Boolean);

  return { ...base, hops, oriented };
}

/**
 * The fridge-side components riding a trunk line, ordered warm → cold: by their
 * stage's `sort_order` (top stage first), then by vertical offset within a band.
 * These are the continuation of a bench chain down through the temperature
 * stages. Free-floating components (not attached to the trunk) are excluded.
 */
export function lineComponents(
  state: DiagramState,
  lineId: string,
): Component[] {
  const stageOrder = new Map(state.stages.map((s) => [s.id, s.sort_order]));
  return state.components
    .filter((c) => c.line_id === lineId && !c.free_floating)
    .map((c) => ({
      component: c,
      order:
        c.stage_id != null
          ? (stageOrder.get(c.stage_id) ?? Number.POSITIVE_INFINITY)
          : Number.POSITIVE_INFINITY,
      y: c.y_abs ?? 0,
    }))
    .sort((a, b) => a.order - b.order || a.y - b.y)
    .map((x) => x.component);
}

/** Trace each port endpoint, assembling every distinct sheet it lives on once. */
function traceEndpoints(
  state: DiagramState,
  ports: Component[],
): TracedChain[] {
  const bySheet = new Map<string | null, Component[]>();
  for (const port of ports) {
    const key = port.sheet_id;
    (bySheet.get(key) ?? bySheet.set(key, []).get(key)!).push(port);
  }
  const chains: TracedChain[] = [];
  for (const [sheetId, group] of bySheet) {
    const view = assembleDiagram(state, sheetId);
    for (const port of group) {
      const chain = traceChain(view, { componentId: port.id });
      chains.push(
        chain.lineId
          ? { ...chain, fridge: lineComponents(state, chain.lineId) }
          : chain,
      );
    }
  }
  return chains;
}

/**
 * The bench chains that terminate at one fridge line. Pure — no DB, no
 * React. Only the `fridge_port`s linking to `lineId` are walked, so this stays
 * cheap enough to call directly when a line is selected. Empty ⇒ nothing links.
 */
export function tracedChainsForLine(
  state: DiagramState,
  lineId: string,
): TracedChain[] {
  const ports = state.components.filter(
    (c) => c.component_type === "fridge_port" && c.linked_line_id === lineId,
  );
  return traceEndpoints(state, ports);
}

/**
 * Every room-temp chain terminating at a fridge line, keyed by line id. Pure —
 * no DB access, no React. Groups the traced chains by the line each links to; a
 * line with no linked endpoint simply has no entry.
 */
export function chainsByLine(state: DiagramState): Map<string, TracedChain[]> {
  const linked = state.components.filter(
    (c) => c.component_type === "fridge_port" && c.linked_line_id != null,
  );
  const result = new Map<string, TracedChain[]>();
  for (const chain of traceEndpoints(state, linked)) {
    if (!chain.lineId) continue;
    (
      result.get(chain.lineId) ??
      result.set(chain.lineId, []).get(chain.lineId)!
    ).push(chain);
  }
  return result;
}

/** Human label for a hop in a traced chain: the instance label, else its type. */
export function hopLabel(component: Component, customDefName?: string): string {
  const name =
    component.label?.trim() ||
    (component.component_type === "custom"
      ? customDefName
      : COMPONENT_LIBRARY[component.component_type]?.label) ||
    "Component";
  const value = component.value?.trim();
  return value ? `${name} (${value})` : name;
}
