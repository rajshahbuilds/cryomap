import { describe, it, expect } from "vitest";
import {
  connectionExists,
  findNearestPort,
  type PortAnchor,
} from "@/lib/diagram/connect";
import { makeConnection } from "./fixtures";

const anchor = (
  componentId: string,
  side: "left" | "right" | "top" | "bottom",
  x: number,
  y: number,
): PortAnchor => ({ componentId, port: { side, index: 0 }, point: { x, y } });

describe("findNearestPort", () => {
  const anchors = [
    anchor("a", "right", 100, 100),
    anchor("b", "left", 200, 100),
    anchor("b", "right", 260, 100),
  ];

  it("returns the nearest port within the snap distance", () => {
    const hit = findNearestPort(anchors, { x: 198, y: 103 }, 16);
    expect(hit?.componentId).toBe("b");
    expect(hit?.port.side).toBe("left");
  });

  it("returns null when nothing is close enough", () => {
    expect(findNearestPort(anchors, { x: 400, y: 400 }, 16)).toBeNull();
  });

  it("excludes ports on the source component (no self-connection)", () => {
    // Closest is a's own port, but it's excluded → falls through to b.
    const hit = findNearestPort(anchors, { x: 104, y: 100 }, 200, "a");
    expect(hit?.componentId).toBe("b");
  });
});

describe("connectionExists", () => {
  const conns = [
    makeConnection({
      from_component_id: "a",
      from_port_side: "right",
      to_component_id: "b",
      to_port_side: "left",
    }),
  ];
  const a = { componentId: "a", port: { side: "right" as const, index: 0 } };
  const b = { componentId: "b", port: { side: "left" as const, index: 0 } };

  it("detects an existing connection regardless of direction", () => {
    expect(connectionExists(conns, a, b)).toBe(true);
    expect(connectionExists(conns, b, a)).toBe(true);
  });

  it("is false for a different port pair", () => {
    const c = { componentId: "c", port: { side: "left" as const, index: 0 } };
    expect(connectionExists(conns, a, c)).toBe(false);
  });
});
