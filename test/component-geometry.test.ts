import { describe, it, expect } from "vitest";
import {
  baseRotationForType,
  componentBaseRotation,
  effectiveRotation,
} from "@/lib/diagram/componentGeometry";
import { makeComponent } from "./fixtures";

describe("baseRotationForType", () => {
  it("turns left/right-only types a quarter-turn", () => {
    // Two-port inline through-components, the power splitter, and the
    // single-left connectors/sensors all have only left/right ports.
    for (const type of [
      "attenuator",
      "filter_lp",
      "amplifier_hemt",
      "isolator",
      "power_splitter",
      "sma_connector",
      "thermometer",
      "heater",
    ] as const) {
      expect(baseRotationForType(type)).toBe(90);
    }
  });

  it("leaves types that already have a top/bottom port upright", () => {
    // circulator (…+bottom), directional_coupler (all four), dut (top).
    for (const type of ["circulator", "directional_coupler", "dut"] as const) {
      expect(baseRotationForType(type)).toBe(0);
    }
  });
});

describe("baseRotationForType — horizontal sheet", () => {
  it("leaves left/right-only types upright: bench flow is already horizontal", () => {
    for (const type of [
      "attenuator",
      "amplifier_hemt",
      "isolator",
      "sma_connector",
    ] as const) {
      expect(baseRotationForType(type, "horizontal")).toBe(0);
    }
  });

  it("turns a top/bottom-only type onto the horizontal flow axis", () => {
    // `dut` has a single top port; on a bench it needs the quarter-turn the
    // fridge doesn't.
    expect(baseRotationForType("dut", "horizontal")).toBe(90);
    expect(baseRotationForType("dut", "vertical")).toBe(0);
  });

  it("never turns mixed-axis built-ins in either orientation", () => {
    for (const type of ["circulator", "directional_coupler"] as const) {
      expect(baseRotationForType(type, "horizontal")).toBe(0);
      expect(baseRotationForType(type, "vertical")).toBe(0);
    }
  });
});

describe("componentBaseRotation", () => {
  it("never turns custom components (their ports are placed deliberately)", () => {
    expect(
      componentBaseRotation(
        makeComponent({ component_type: "custom", custom_def_id: "d" }),
      ),
    ).toBe(0);
  });
});

describe("effectiveRotation", () => {
  it("adds the base turn to the stored rotation, wrapping at 360", () => {
    const att = (rotation: 0 | 90 | 180 | 270) =>
      effectiveRotation(
        makeComponent({ component_type: "attenuator", rotation }),
      );
    expect(att(0)).toBe(90);
    expect(att(90)).toBe(180);
    expect(att(180)).toBe(270);
    expect(att(270)).toBe(0);
  });

  it("is just the stored rotation when there's no base turn", () => {
    expect(
      effectiveRotation(
        makeComponent({ component_type: "circulator", rotation: 90 }),
      ),
    ).toBe(90);
  });

  it("drops the base turn for an attenuator on a horizontal bench sheet", () => {
    const att = makeComponent({ component_type: "attenuator", rotation: 0 });
    expect(effectiveRotation(att, "vertical")).toBe(90);
    expect(effectiveRotation(att, "horizontal")).toBe(0);
  });
});
