import { describe, it, expect } from "vitest";
import {
  lineTypeSchema,
  entityStatusSchema,
  componentTypeSchema,
  rotationSchema,
  portSchema,
  fridgeCreateSchema,
  lineCreateSchema,
  componentCreateSchema,
  customComponentDefCreateSchema,
  stageRowSchema,
  componentRowSchema,
} from "@/lib/types";
import { makeStage, makeComponent } from "./fixtures";

const UUID = "00000000-0000-4000-8000-000000000abc";

describe("enums", () => {
  it("accepts valid values", () => {
    expect(lineTypeSchema.parse("xy_drive")).toBe("xy_drive");
    expect(entityStatusSchema.parse("working")).toBe("working");
    expect(componentTypeSchema.parse("attenuator")).toBe("attenuator");
    expect(componentTypeSchema.parse("custom")).toBe("custom");
    expect(rotationSchema.parse(270)).toBe(270);
    expect(portSchema.parse({ side: "left", index: 0 })).toEqual({
      side: "left",
      index: 0,
    });
  });

  it("rejects invalid values", () => {
    expect(() => lineTypeSchema.parse("nope")).toThrow();
    expect(() => entityStatusSchema.parse("on_fire")).toThrow();
    expect(() => rotationSchema.parse(45)).toThrow();
    expect(() => portSchema.parse({ side: "middle", index: 0 })).toThrow();
  });
});

describe("create schemas", () => {
  it("validates a minimal fridge create payload", () => {
    expect(fridgeCreateSchema.parse({ name: "DR-1" })).toMatchObject({
      name: "DR-1",
    });
  });

  it("rejects an empty fridge name", () => {
    expect(() => fridgeCreateSchema.parse({ name: "" })).toThrow();
  });

  it("rejects a line create with an invalid line_type", () => {
    expect(() =>
      lineCreateSchema.parse({
        fridge_id: UUID,
        name: "Readout",
        sort_order: 0,
        line_type: "bogus",
      }),
    ).toThrow();
  });

  it("rejects a component create with an invalid rotation", () => {
    expect(() =>
      componentCreateSchema.parse({
        fridge_id: UUID,
        component_type: "attenuator",
        rotation: 45,
      }),
    ).toThrow();
  });

  it("rejects a non-uuid fridge_id", () => {
    expect(() =>
      customComponentDefCreateSchema.parse({ fridge_id: "nope", name: "X" }),
    ).toThrow();
  });
});

describe("row schemas", () => {
  it("parses full fixture rows", () => {
    const stage = makeStage();
    const component = makeComponent({ value: "-20 dB", rotation: 90 });
    expect(stageRowSchema.parse(stage)).toEqual(stage);
    expect(componentRowSchema.parse(component)).toEqual(component);
  });

  it("rejects a row with a bad enum value", () => {
    const bad = { ...makeComponent(), component_type: "exploded" };
    expect(() => componentRowSchema.parse(bad)).toThrow();
  });
});
