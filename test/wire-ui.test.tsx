import { describe, it, expect, vi, afterEach } from "vitest";
import { WirePropertiesPanel } from "@/components/diagram/WirePropertiesPanel";
import { WireSegments } from "@/components/diagram/WireSegment";
import { DEFAULT_WIRE_PROPERTIES, wirePropertiesSchema } from "@/lib/types";
import { renderWithProviders, screen, cleanup } from "./render";

afterEach(cleanup);
const defaults = {
  properties: DEFAULT_WIRE_PROPERTIES,
  readOnly: false,
  endpoints: "A → B",
  onSave: vi.fn(),
};
describe("wire properties panel", () => {
  it("saves text on blur before a selection can unmount the panel", async () => {
    const save = vi.fn();
    const { user, unmount } = renderWithProviders(
      <WirePropertiesPanel {...defaults} onSave={save} />,
    );
    await user.type(
      screen.getByLabelText("Label", { exact: true }),
      "Sensor A",
    );
    expect(save).not.toHaveBeenCalled();
    await user.tab();
    expect(save).toHaveBeenLastCalledWith({ label: "Sensor A" });
    unmount();
    expect(save).toHaveBeenCalledOnce();
  });
  it("validates and trims datasheet URLs before saving", async () => {
    const save = vi.fn();
    const { user } = renderWithProviders(
      <WirePropertiesPanel {...defaults} onSave={save} />,
    );
    const input = screen.getByLabelText("Datasheet URL");
    await user.type(input, "not a URL");
    await user.tab();
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a valid datasheet URL.",
    );
    await user.clear(input);
    await user.type(input, "  https://example.com/wire.pdf  ");
    await user.tab();
    expect(save).toHaveBeenLastCalledWith({
      datasheet_url: "https://example.com/wire.pdf",
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("clears a saved datasheet URL", async () => {
    const save = vi.fn();
    const { user } = renderWithProviders(
      <WirePropertiesPanel
        {...defaults}
        properties={wirePropertiesSchema.parse({
          datasheet_url: "https://example.com/wire.pdf",
        })}
        onSave={save}
      />,
    );
    await user.clear(screen.getByLabelText("Datasheet URL"));
    await user.tab();
    expect(save).toHaveBeenLastCalledWith({ datasheet_url: null });
  });
  it("changes construction and visibility as independent patches", async () => {
    const save = vi.fn();
    const { user } = renderWithProviders(
      <WirePropertiesPanel {...defaults} onSave={save} />,
    );
    expect(screen.getByLabelText("Show label on diagram")).not.toBeChecked();
    await user.selectOptions(
      screen.getByLabelText("Construction", { exact: true }),
      "twisted_pair",
    );
    await user.click(screen.getByLabelText("Show label on diagram"));
    expect(save.mock.calls.map((c) => c[0])).toEqual([
      { construction: "twisted_pair" },
      { show_label: true },
    ]);
  });
  it("validates measurement values and retains their units", async () => {
    const save = vi.fn();
    const { user } = renderWithProviders(
      <WirePropertiesPanel {...defaults} onSave={save} />,
    );
    const length = screen.getByLabelText("Length", { exact: true });
    await user.type(length, "-2");
    await user.click(screen.getByLabelText("Label", { exact: true }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
    await user.clear(length);
    await user.type(length, "25");
    await user.selectOptions(screen.getByLabelText("Length unit"), "cm");
    expect(save).toHaveBeenLastCalledWith({
      length: { value: 25, unit: "cm" },
    });
  });
  it("supports /0 AWG", async () => {
    const save = vi.fn();
    const { user } = renderWithProviders(
      <WirePropertiesPanel {...defaults} onSave={save} />,
    );
    await user.type(
      screen.getByLabelText("Gauge / diameter", { exact: true }),
      "2/0",
    );
    await user.click(screen.getByLabelText("Label", { exact: true }));
    expect(save).toHaveBeenLastCalledWith({ size: { value: -1, unit: "awg" } });
  });
  it("clears an optional size to null", async () => {
    const save = vi.fn();
    const { user } = renderWithProviders(
      <WirePropertiesPanel
        {...defaults}
        properties={wirePropertiesSchema.parse({
          size: { value: 36, unit: "awg" },
        })}
        onSave={save}
      />,
    );
    await user.clear(
      screen.getByLabelText("Gauge / diameter", { exact: true }),
    );
    await user.click(screen.getByLabelText("Label", { exact: true }));
    expect(save).toHaveBeenLastCalledWith({ size: null });
  });
  it("shows shield materials for coax and triax", () => {
    renderWithProviders(
      <WirePropertiesPanel
        {...defaults}
        properties={wirePropertiesSchema.parse({ construction: "triaxial" })}
      />,
    );
    expect(screen.getByLabelText("Inner shield material")).toBeInTheDocument();
    expect(screen.getByLabelText("Outer shield material")).toBeInTheDocument();
  });
  it("updates fields after undo without replacing an unrelated draft", async () => {
    const { user, rerender } = renderWithProviders(
      <WirePropertiesPanel
        {...defaults}
        properties={wirePropertiesSchema.parse({ label: "new" })}
      />,
    );
    await user.type(screen.getByLabelText("Conductor material"), "copper");
    rerender(
      <WirePropertiesPanel
        {...defaults}
        properties={wirePropertiesSchema.parse({ label: "old" })}
      />,
    );
    expect(screen.getByLabelText("Label", { exact: true })).toHaveValue("old");
    expect(screen.getByLabelText("Conductor material")).toHaveValue("copper");
  });
  it("allows inspection but disables all edits when read-only", () => {
    renderWithProviders(<WirePropertiesPanel {...defaults} readOnly />);
    expect(
      screen.getByLabelText("Construction", { exact: true }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Length", { exact: true })).toBeDisabled();
    expect(screen.getByLabelText("Datasheet URL")).toBeDisabled();
    expect(screen.getByLabelText("Show label on diagram")).toBeDisabled();
  });
});
describe("saved wire labels", () => {
  it("keeps labels hidden until enabled and includes enabled labels in SVG", () => {
    const wire = {
      key: "x",
      from: { x: 0, y: 0 },
      to: { x: 100, y: 100 },
      properties: wirePropertiesSchema.parse({
        label: "Sensor A",
        construction: "twisted_pair",
      }),
    };
    const { container, rerender } = renderWithProviders(
      <svg>
        <WireSegments wires={[wire]} />
      </svg>,
    );
    expect(container.querySelector("text")).toBeNull();
    rerender(
      <svg>
        <WireSegments
          wires={[
            { ...wire, properties: { ...wire.properties, show_label: true } },
          ]}
        />
      </svg>,
    );
    expect(container.querySelector("text")).toHaveTextContent("Sensor A");
    expect(container.querySelectorAll("path").length).toBeGreaterThan(1);
    expect(
      container.querySelector("text")?.getAttribute("pointer-events"),
    ).toBe("none");
  });
  it("allows keyboard selection of a wire", async () => {
    const select = vi.fn();
    const { user } = renderWithProviders(
      <svg>
        <WireSegments
          wires={[{ key: "x", from: { x: 0, y: 0 }, to: { x: 100, y: 0 } }]}
          onSelect={select}
        />
      </svg>,
    );
    await user.tab();
    await user.keyboard("{Enter}");
    expect(select).toHaveBeenCalledWith("x");
  });
});
