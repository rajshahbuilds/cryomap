import { describe, it, expect } from "vitest";
import {
  COMPONENT_DEFINITIONS,
  getComponentDefinition,
  componentsByCategory,
  LINE_TYPE_META,
  getLineTypeColor,
} from "@/lib/constants";
import { BUILT_IN_COMPONENT_TYPES, LINE_TYPES } from "@/lib/types";

describe("component library", () => {
  it("defines every built-in component type in enum order", () => {
    expect(COMPONENT_DEFINITIONS).toHaveLength(BUILT_IN_COMPONENT_TYPES.length);
    expect(COMPONENT_DEFINITIONS.map((d) => d.type)).toEqual([
      ...BUILT_IN_COMPONENT_TYPES,
    ]);
  });

  it("gives every definition at least one port and a category", () => {
    for (const def of COMPONENT_DEFINITIONS) {
      expect(def.ports.length).toBeGreaterThan(0);
      expect(def.category).toBeTruthy();
    }
  });

  it("looks up a definition and applies default fields", () => {
    expect(getComponentDefinition("attenuator").defaultFields.value).toBe(
      "-20 dB",
    );
    expect(getComponentDefinition("dut").allowedLineTypes).toBeNull();
  });

  it("groups definitions by category", () => {
    expect(componentsByCategory("active").map((d) => d.type)).toEqual([
      "amplifier_hemt",
      "amplifier_roomtemp",
      "amplifier_parametric",
    ]);
  });

  it("groups the signal I/O port markers", () => {
    expect(componentsByCategory("io").map((d) => d.type)).toEqual([
      "input_port",
      "output_port",
      "bidir_port",
      "fridge_port",
    ]);
  });

  it("gives every definition a non-empty sheetKinds", () => {
    for (const def of COMPONENT_DEFINITIONS) {
      expect(def.sheetKinds.length).toBeGreaterThan(0);
    }
  });

  it("filters a category by sheet kind", () => {
    // fridge_port is room-temp only; the generic markers are on both.
    expect(componentsByCategory("io", "fridge").map((d) => d.type)).toEqual([
      "input_port",
      "output_port",
      "bidir_port",
    ]);
    expect(componentsByCategory("source", "fridge")).toEqual([]);
    expect(
      componentsByCategory("source", "room_temp").map((d) => d.type),
    ).toEqual(["signal_generator", "awg"]);
  });
});

describe("line types", () => {
  it("maps every line type to a distinct color", () => {
    const colors = LINE_TYPES.map((t) => getLineTypeColor(t));
    expect(new Set(colors).size).toBe(LINE_TYPES.length);
  });

  it("has metadata for every line type", () => {
    for (const type of LINE_TYPES) {
      expect(LINE_TYPE_META[type].label).toBeTruthy();
    }
  });
});
