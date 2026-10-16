import { describe, it, expect } from "vitest";
import { renderWithProviders, screen } from "./render";
import { BUILT_IN_COMPONENT_TYPES } from "@/lib/types";
import {
  ComponentCaption,
  ComponentSymbol,
} from "@/components/diagram/ComponentSymbol";
import { makeComponent, makeCustomComponentDef } from "./fixtures";

describe("ComponentSymbol built-in glyphs", () => {
  it.each(BUILT_IN_COMPONENT_TYPES)("renders a stable %s symbol", (type) => {
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({
            id: "c",
            component_type: type,
            label: null,
            value: null,
            rotation: 0,
          })}
        />
      </svg>,
    );
    expect(
      container.querySelector("[data-component-type]")?.innerHTML,
    ).toMatchSnapshot();
  });

  it.each([
    ["input_port", "Input"],
    ["output_port", "Output"],
    ["bidir_port", "Bidirectional"],
  ] as const)(
    "renders the %s flag with one port and its label",
    (type, label) => {
      const { container } = renderWithProviders(
        <svg>
          <ComponentSymbol
            component={makeComponent({ id: "c", component_type: type })}
          />
        </svg>,
      );
      expect(container.querySelector("polygon")).toBeInTheDocument();
      expect(container.querySelectorAll('circle[r="3"]')).toHaveLength(1);
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );

  it("draws one port dot per port (circulator → 3)", () => {
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({ id: "c", component_type: "circulator" })}
        />
      </svg>,
    );
    expect(container.querySelectorAll('circle[r="3"]')).toHaveLength(3);
  });

  const fridgePort = () =>
    makeComponent({ id: "c", component_type: "fridge_port", label: null });

  it("labels a linked fridge_port with its line name", () => {
    renderWithProviders(
      <svg>
        <ComponentSymbol component={fridgePort()} linkedLineName="2B" />
      </svg>,
    );
    expect(screen.getByText("2B")).toBeInTheDocument();
  });

  it("shows no line name on an unlinked fridge_port", () => {
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol component={fridgePort()} />
      </svg>,
    );
    // The "Fridge Port" caption still renders, but there's no in-tag line-name
    // glyph (the snowflake stands in instead).
    expect(screen.getByText("Fridge Port")).toBeInTheDocument();
    expect(container.querySelector('text[fill="#1a1d27"]')).toBeNull();
  });

  it("captions with the library label and the value", () => {
    renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({
            id: "c",
            component_type: "filter_lp",
            label: null,
            value: "12 GHz",
          })}
        />
      </svg>,
    );
    expect(screen.getByText("Low-pass Filter")).toBeInTheDocument();
    expect(screen.getByText("12 GHz")).toBeInTheDocument();
  });

  it("shows an attenuator's value inside its box, not in the caption", () => {
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({
            id: "c",
            component_type: "attenuator",
            label: null,
            value: "-20 dB",
            rotation: 0,
          })}
        />
      </svg>,
    );
    // The value is the in-box glyph label (upright, filled — not a haloed caption).
    const inBox = screen.getByText("-20 dB");
    expect(inBox).toHaveAttribute("fill", "#1a1d27");
    expect(inBox.getAttribute("class") ?? "").not.toContain("stroke-surface");
    // No ✕ crossing lines remain inside the box.
    const diagonals = [...container.querySelectorAll("line")].filter((l) => {
      const x1 = l.getAttribute("x1");
      const y1 = l.getAttribute("y1");
      return x1 !== "0" && y1 !== "0" && x1 !== y1; // a slanted (X) line
    });
    expect(diagonals).toHaveLength(0);
  });

  it("omits the caption when showCaption is false", () => {
    renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({
            id: "c",
            component_type: "filter_lp",
            label: null,
            value: "12 GHz",
          })}
          showCaption={false}
        />
      </svg>,
    );
    expect(screen.queryByText("Low-pass Filter")).not.toBeInTheDocument();
    expect(screen.queryByText("12 GHz")).not.toBeInTheDocument();
  });
});

describe("ComponentCaption", () => {
  it("renders label + value with a legibility halo", () => {
    const { container } = renderWithProviders(
      <svg>
        <ComponentCaption
          component={makeComponent({
            id: "c",
            component_type: "filter_lp",
            label: "amp_0",
            value: "-20 dB",
          })}
        />
      </svg>,
    );
    const label = screen.getByText("amp_0");
    // Halo = a surface-colored stroke painted behind the fill.
    expect(label).toHaveAttribute("paint-order", "stroke");
    expect(label.getAttribute("class")).toContain("stroke-surface");
    expect(container.querySelectorAll("text")).toHaveLength(2);
  });
});

describe("ComponentSymbol rotation", () => {
  it("applies the stored rotation transform to the glyph group", () => {
    // Circulator has a bottom port, so it carries no base turn — its transform
    // reflects the stored rotation directly.
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({
            id: "c",
            component_type: "circulator",
            rotation: 90,
          })}
        />
      </svg>,
    );
    const group = container.querySelector("[data-component-type] > g");
    expect(group?.getAttribute("transform")).toContain("rotate(90)");
  });

  it("turns left/right-only components a quarter-turn by default", () => {
    // An attenuator (left/right ports only) is drawn vertical at rotation 0 so
    // its ports face top/bottom along the trunk.
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({
            id: "c",
            component_type: "attenuator",
            rotation: 0,
          })}
        />
      </svg>,
    );
    const group = container.querySelector("[data-component-type] > g");
    expect(group?.getAttribute("transform")).toContain("rotate(90)");
  });

  it("adds the stored rotation on top of the base turn", () => {
    // Stored 90° + base 90° → 180°.
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol
          component={makeComponent({
            id: "c",
            component_type: "attenuator",
            rotation: 90,
          })}
        />
      </svg>,
    );
    const group = container.querySelector("[data-component-type] > g");
    expect(group?.getAttribute("transform")).toContain("rotate(180)");
  });
});

describe("ComponentSymbol custom definitions", () => {
  it("renders a box sized to the def, with its ports and name", () => {
    const def = makeCustomComponentDef({
      id: "d",
      name: "My Splitter",
      width_px: 120,
      height_px: 80,
    });
    const component = makeComponent({
      id: "c",
      component_type: "custom",
      custom_def_id: "d",
      label: null,
      value: null,
    });

    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol component={component} def={def} />
      </svg>,
    );

    const rect = container.querySelector("rect");
    expect(rect?.getAttribute("width")).toBe("120");
    expect(rect?.getAttribute("height")).toBe("80");
    expect(container.querySelectorAll('circle[r="3"]')).toHaveLength(
      def.ports.length,
    );
    // The def name labels the box (its on-canvas identity) and isn't repeated as
    // a caption when the instance has no label of its own.
    expect(screen.getByText("My Splitter")).toBeInTheDocument();
    expect(screen.getAllByText("My Splitter")).toHaveLength(1);
  });

  it("shows the def name in the box and the instance label as a caption", () => {
    const def = makeCustomComponentDef({
      id: "d",
      name: "My Splitter",
      width_px: 120,
    });
    const component = makeComponent({
      id: "c",
      component_type: "custom",
      custom_def_id: "d",
      label: "splitter_1",
      value: "3 dB",
    });

    renderWithProviders(
      <svg>
        <ComponentSymbol component={component} def={def} />
      </svg>,
    );

    expect(screen.getByText("My Splitter")).toBeInTheDocument();
    expect(screen.getByText("splitter_1")).toBeInTheDocument();
    expect(screen.getByText("3 dB")).toBeInTheDocument();
  });

  it("truncates a name too long for the box with an ellipsis", () => {
    const def = makeCustomComponentDef({
      id: "d",
      name: "Cryogenic Low-Noise Amplifier Stage 3",
      width_px: 80,
    });
    const component = makeComponent({
      id: "c",
      component_type: "custom",
      custom_def_id: "d",
      label: null,
      value: null,
    });

    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol component={component} def={def} />
      </svg>,
    );

    const text = container.querySelector("text")?.textContent ?? "";
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThan(def.name.length);
  });

  it("falls back to 'Custom' inside the box when the def is unresolved", () => {
    const component = makeComponent({
      id: "c",
      component_type: "custom",
      custom_def_id: "d",
      label: null,
      value: null,
    });

    renderWithProviders(
      <svg>
        <ComponentSymbol component={component} def={null} />
      </svg>,
    );

    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("sticks ports out of the box on lead stubs", () => {
    // 80×40 box → right edge at x=40; a port sits 10px out at x=50.
    const def = makeCustomComponentDef({ id: "d" });
    const component = makeComponent({
      id: "c",
      component_type: "custom",
      custom_def_id: "d",
    });
    const { container } = renderWithProviders(
      <svg>
        <ComponentSymbol component={component} def={def} />
      </svg>,
    );

    const dotX = [...container.querySelectorAll('circle[r="3"]')]
      .map((c) => Number(c.getAttribute("cx")))
      .sort((a, b) => a - b);
    expect(dotX).toEqual([-50, 50]);

    // One lead stub per port, each bridging the box edge to the port dot.
    const leads = [...container.querySelectorAll("line")];
    expect(leads).toHaveLength(def.ports.length);
    const right = leads.find((l) => l.getAttribute("x2") === "50");
    expect(right?.getAttribute("x1")).toBe("40");
  });
});
