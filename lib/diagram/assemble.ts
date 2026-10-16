import type {
  Annotation,
  Component,
  Connection,
  CustomComponentDef,
  DiagramState,
  Line,
  Port,
  PortSide,
  Sheet,
  Stage,
} from "@/lib/types";
import type { Point } from "@/lib/diagram/camera";
import { lineColumnXById } from "@/lib/diagram/lines";
import { layoutStageBands, type StageBand } from "@/lib/diagram/stages";
import {
  componentPorts,
  componentPortLead,
  componentSize,
  effectiveRotation,
} from "@/lib/diagram/componentGeometry";
import { componentBox } from "@/lib/diagram/placement";
import {
  resolveActiveSheet,
  sheetOrientation,
} from "@/lib/diagram/sheetService";
import type { FlowOrientation } from "@/lib/diagram/componentGeometry";
import { effectiveSide, portPositions } from "@/lib/diagram/ports";
import type { PortAnchor } from "@/lib/diagram/connect";
import {
  implicitWires,
  pointsToPath,
  pruneCollinear,
  resolveExplicitWires,
  separateLanes,
  trunkCrossingVerticals,
  wireJunctions,
  wirePathsWithHops,
  type ExplicitWire,
  type PlacedComponent,
  type Wire,
  type WireObstacle,
} from "@/lib/diagram/wires";

/** A component resolved to a logical anchor position on the canvas. */
export interface PositionedComponent {
  component: Component;
  x: number;
  y: number;
}

/**
 * Everything the read-only canvas needs to draw **one sheet**, derived from a
 * whole fridge's raw diagram state. Every field below `sheets` is scoped to the
 * rendered sheet.
 */
export interface DiagramView {
  /** Every sheet of the fridge, in `sort_order` (for the tab bar). */
  sheets: Sheet[];
  /** The sheet this view renders. `null` only for a fridge with no sheets. */
  sheet: Sheet | null;
  /** The rendered sheet's signal-flow direction (drives the base rotation). */
  orientation: FlowOrientation;
  /** This sheet's stages. Always empty on a room-temp sheet. */
  stages: Stage[];
  /** This sheet's lines. Always empty on a room-temp sheet. */
  lines: Line[];
  /** This sheet's component rows (`positioned` omits unanchored ones). */
  components: Component[];
  positioned: PositionedComponent[];
  /** Implicit trunk wires (components down a line). */
  wires: Wire[];
  /** Explicit, user-drawn port-to-port connections, resolved to segments. */
  explicitWires: Wire[];
  /** Points where wires connect/branch and should carry a junction dot. */
  junctions: Point[];
  /** Every component port resolved to an absolute point (for drawing/hit-tests). */
  portAnchors: PortAnchor[];
  /** Raw connection rows (for validation + deletion in the editor). */
  connections: Connection[];
  /** This sheet's text annotations. */
  annotations: Annotation[];
  customDefById: Map<string, CustomComponentDef>;
  /**
   * Every fridge line by id → name, across *all* sheets — so a `fridge_port` on
   * a room-temp sheet can label itself with the fridge line it links to,
   * even though that line lives on a different (fridge) sheet.
   */
  lineNameById: Map<string, string>;
}

const portKey = (port: Port) => `${port.side}:${port.index}`;

/** Map a stored connection row to the resolver's endpoint-ref shape. */
function connectionToWire(connection: Connection): ExplicitWire {
  return {
    id: connection.id,
    from: {
      componentId: connection.from_component_id,
      port: {
        side: connection.from_port_side,
        index: connection.from_port_index,
      },
    },
    to: {
      componentId: connection.to_component_id,
      port: { side: connection.to_port_side, index: connection.to_port_index },
    },
  };
}

interface AnchorContext {
  lineXById: Map<string, number>;
  bandById: Map<string, StageBand>;
}

/**
 * Resolve a component's anchor. Horizontally, a component
 * attached to a trunk line tracks that trunk's x; otherwise it uses its
 * absolute x. Vertically, a stage-pinned component sits at a band-relative y
 * (so it follows the band), and a white-space component uses its absolute y;
 * legacy line×stage-snapped components (no stored coords) center in the band.
 * Returns `null` when the component can't be placed.
 */
function componentAnchor(
  component: Component,
  { lineXById, bandById }: AnchorContext,
): Point | null {
  // Horizontal: a trunk-attached component follows its line; else absolute x.
  const trunkX = component.line_id ? lineXById.get(component.line_id) : null;
  const x = trunkX ?? component.x_abs;

  // Vertical: band-relative offset when pinned to a stage; else absolute y.
  const band = component.stage_id ? bandById.get(component.stage_id) : null;
  let y: number | null = null;
  if (band && component.y_abs != null) {
    const offset = Math.min(Math.max(component.y_abs, 0), band.height);
    y = band.y + offset;
  } else if (band) {
    // Legacy line×stage snap with no stored y: centered in the band.
    y = band.y + band.height / 2;
  } else if (component.stage_id == null && component.y_abs != null) {
    y = component.y_abs;
  }

  if (x == null || y == null) return null;
  return { x, y };
}

/**
 * Which sheet a row belongs to. A null `sheet_id` means the row predates sheets
 * (the column is nullable until the NOT NULL migration lands, and pre-sheets
 * version snapshots carry no `sheet_id` at all) — such rows are fridge wiring,
 * because that is the only diagram that existed before sheets.
 */
function onSheet(rowSheetId: string | null, sheet: Sheet): boolean {
  return rowSheetId === null
    ? sheet.kind === "fridge"
    : rowSheetId === sheet.id;
}

/**
 * Assemble raw diagram state into a render-ready view of **one sheet**:
 * positioned components, implicit trunk wires, and a custom-definition lookup.
 * Pure — the hook fetches a whole fridge, this narrows and normalizes, and the
 * canvas components are pure consumers.
 *
 * `sheetId` selects the sheet to render; it falls back to a fridge sheet. Every
 * row — stages and lines included — is scoped to its sheet, so two fridge sheets
 * of the same cryostat have independent temperature bands and trunk lines. A
 * room-temp sheet has neither: no bands, no trunk columns, and therefore no
 * implicit wires — only free-floating components and explicit connections.
 */
export function assembleDiagram(
  state: DiagramState,
  sheetId?: string | null,
): DiagramView {
  const sheet = resolveActiveSheet(state.sheets, sheetId ?? null);
  const orientation = sheetOrientation(sheet);

  // State with no sheets at all is pre-sheets: a restored old version snapshot,
  // or a fridge the backfill hasn't reached. It *is* fridge wiring, so render it
  // whole rather than filtering it away to a blank canvas.
  const legacy = state.sheets.length === 0;

  const onThisSheet = (rowSheetId: string | null) =>
    legacy || (sheet != null && onSheet(rowSheetId, sheet));

  const components = state.components.filter((c) => onThisSheet(c.sheet_id));
  const connections = state.connections.filter((c) => onThisSheet(c.sheet_id));
  const stages = state.stages.filter((s) => onThisSheet(s.sheet_id));
  const lines = state.lines.filter((l) => onThisSheet(l.sheet_id));
  const annotations = state.annotations.filter((a) => onThisSheet(a.sheet_id));

  const bands = layoutStageBands(stages);
  const bandById = new Map(bands.map((band) => [band.stage.id, band]));
  const lineXById = lineColumnXById(lines);
  const customDefById = new Map(state.customDefs.map((def) => [def.id, def]));
  // All fridge lines (every sheet), so a room-temp fridge_port can name its link.
  const lineNameById = new Map(state.lines.map((l) => [l.id, l.name]));

  const positioned: PositionedComponent[] = [];
  const placedForWires: PlacedComponent[] = [];

  for (const component of components) {
    const anchor = componentAnchor(component, { lineXById, bandById });
    if (!anchor) continue;
    positioned.push({ component, x: anchor.x, y: anchor.y });

    // Components attached to a trunk get joined down the line by implicit wires.
    if (!component.free_floating && component.line_id) {
      placedForWires.push({
        id: component.id,
        lineId: component.line_id,
        x: anchor.x,
        y: anchor.y,
      });
    }
  }

  // Resolve each component's ports to absolute logical points (anchor + the
  // rotation-aware local port offset), so explicit connections can be drawn
  // and hit-tested.
  const portsByComponent = new Map<
    string,
    Map<string, { point: Point; side: PortSide }>
  >();
  const portAnchors: PortAnchor[] = [];
  const obstacles: WireObstacle[] = [];
  for (const { component, x, y } of positioned) {
    const def = component.custom_def_id
      ? (customDefById.get(component.custom_def_id) ?? null)
      : null;
    const size = componentSize(component, def);
    const rotation = effectiveRotation(component, orientation);
    obstacles.push({
      componentId: component.id,
      box: componentBox({ x, y }, size, rotation),
    });
    const placed = portPositions(
      componentPorts(component, def),
      size,
      rotation,
      component.mirrored,
      componentPortLead(component),
    );
    const map = new Map<string, { point: Point; side: PortSide }>();
    for (const p of placed) {
      const point = { x: x + p.x, y: y + p.y };
      // The wire leaves in the port's *visual* facing (after rotation/mirror).
      const side = effectiveSide(p.port.side, rotation, component.mirrored);
      map.set(portKey(p.port), { point, side });
      portAnchors.push({ componentId: component.id, port: p.port, point });
    }
    portsByComponent.set(component.id, map);
  }
  const portAt = (componentId: string, port: Port) =>
    portsByComponent.get(componentId)?.get(portKey(port)) ?? null;

  const wires = implicitWires(placedForWires);
  const explicitWires = resolveExplicitWires(
    connections.map(connectionToWire),
    portAt,
    obstacles,
  );

  // Hops, junction dots, and lane separation are derived across *all* wires at
  // once — here is the only place that sees both implicit trunks and explicit
  // connections, so over/under, connect-vs-cross, and parallel runs read
  // consistently regardless of which layer each wire renders in.
  const routed = [...wires, ...explicitWires].filter(
    (w): w is Wire & { points: Point[] } => w.points != null,
  );
  // Spread overlapping parallel runs onto separate lanes before deriving paths,
  // then drop redundant collinear vertices: a stray vertex left mid-run (e.g. a
  // port stub) would otherwise split a straight segment, and a wire crossing
  // exactly at that vertex would fall in the gap between the two sub-segments and
  // skip its hop — reading as a flat four-way cross instead of an overlap.
  const lanes = separateLanes(routed.map((w) => w.points));
  routed.forEach((wire, i) => {
    wire.points = pruneCollinear(lanes[i]);
  });
  // Wires hop over the vertical trunk lines they merely cross, so a crossing
  // reads as an overlap rather than a short.
  const trunkVerticals = trunkCrossingVerticals(
    [...lineXById.values()],
    routed.map((w) => w.points),
  );
  const hopPaths = wirePathsWithHops(
    routed.map((w) => ({ key: w.key, points: w.points })),
    trunkVerticals,
  );
  for (const wire of routed) {
    wire.path = hopPaths.get(wire.key) ?? pointsToPath(wire.points);
  }
  const junctions = wireJunctions(routed.map((w) => w.points));

  return {
    sheets: state.sheets,
    sheet,
    orientation,
    stages,
    lines,
    components,
    positioned,
    wires,
    explicitWires,
    junctions,
    portAnchors,
    connections,
    annotations,
    customDefById,
    lineNameById,
  };
}
