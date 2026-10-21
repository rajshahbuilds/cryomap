import { describe, expect, it } from "vitest";
import {
  withComponentPosition,
  withoutComponents,
  withoutConnection,
} from "@/lib/diagram/optimisticState";
import type { DiagramState } from "@/lib/types";
import { makeComponent, makeConnection } from "./fixtures";

const state = (): DiagramState => ({
  sheets: [],
  stages: [],
  lines: [],
  customDefs: [],
  annotations: [],
  components: [
    makeComponent({ id: "c1", x_abs: 10, y_abs: 20 }),
    makeComponent({ id: "c2", x_abs: 30, y_abs: 40 }),
  ],
  connections: [
    makeConnection({
      id: "wire-1",
      from_component_id: "c1",
      to_component_id: "c2",
    }),
  ],
});

describe("optimistic diagram state", () => {
  it("moves only the selected component", () => {
    const next = withComponentPosition(state(), "c1", {
      line_id: null,
      stage_id: null,
      free_floating: true,
      x_abs: 120,
      y_abs: 240,
    });

    expect(next.components[0]).toMatchObject({ x_abs: 120, y_abs: 240 });
    expect(next.components[1]).toMatchObject({ x_abs: 30, y_abs: 40 });
  });

  it("removes components and their incident wires", () => {
    const next = withoutComponents(state(), ["c1"]);

    expect(next.components.map((component) => component.id)).toEqual(["c2"]);
    expect(next.connections).toEqual([]);
  });

  it("removes only the selected wire", () => {
    const next = withoutConnection(state(), "wire-1");

    expect(next.connections).toEqual([]);
    expect(next.components).toHaveLength(2);
  });
});
