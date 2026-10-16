import { describe, it, expect } from "vitest";
import type {
  Tables,
  Profile,
  Fridge,
  Stage,
  Line,
  Lock,
  Component,
  Connection,
  CustomComponentDef,
  Sheet,
  Annotation,
  Version,
} from "@/lib/types";

/**
 * Compile-time conformance guard binding the two type representations:
 * the hand-authored Zod domain Row types must remain assignable to the
 * generated Supabase `Tables<...>` Row types. If a migration adds, renames,
 * or retypes a column and the Zod schema isn't updated to match, the relevant
 * `Conforms<...>` resolves to `false` and `pnpm typecheck` fails in CI.
 *
 * The JSON columns we intentionally narrow (extra_fields/ports/snapshot) are
 * omitted from their table's check — the generated type for those is `Json`,
 * which our typed shapes deliberately diverge from.
 */
type Conforms<Domain, DbRow> = Domain extends DbRow ? true : false;

const CONFORMANCE = {
  profiles: true satisfies Conforms<Profile, Tables<"profiles">>,
  fridges: true satisfies Conforms<Fridge, Tables<"fridges">>,
  stages: true satisfies Conforms<Stage, Tables<"stages">>,
  lines: true satisfies Conforms<Line, Tables<"lines">>,
  locks: true satisfies Conforms<Lock, Tables<"locks">>,
  sheets: true satisfies Conforms<Sheet, Tables<"sheets">>,
  connections: true satisfies Conforms<Connection, Tables<"connections">>,
  annotations: true satisfies Conforms<Annotation, Tables<"annotations">>,
  components: true satisfies Conforms<
    Omit<Component, "extra_fields">,
    Omit<Tables<"components">, "extra_fields">
  >,
  custom_component_defs: true satisfies Conforms<
    Omit<CustomComponentDef, "ports">,
    Omit<Tables<"custom_component_defs">, "ports">
  >,
  versions: true satisfies Conforms<
    Omit<Version, "snapshot">,
    Omit<Tables<"versions">, "snapshot">
  >,
} as const;

describe("types conformance", () => {
  it("domain row types conform to the generated DB types (enforced at typecheck)", () => {
    expect(Object.values(CONFORMANCE).every(Boolean)).toBe(true);
  });
});
