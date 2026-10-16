import { describe, it, expect, vi, afterEach } from "vitest";
import { renderWithProviders, screen, cleanup, waitFor } from "./render";
import { PropertiesPanel } from "@/components/diagram/PropertiesPanel";
import {
  makeComponent,
  makeCustomComponentDef,
  makeFridge,
  makeLine,
} from "./fixtures";

afterEach(cleanup);

describe("PropertiesPanel contexts", () => {
  it("shows component fields", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ id: "c", value: "-20 dB" }),
          def: null,
        }}
        readOnly={false}
        onSave={vi.fn()}
      />,
    );
    // The heading is the component's type (default fixture is an attenuator).
    expect(
      screen.getByRole("heading", { name: "Attenuator" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Value")).toHaveValue("-20 dB");
    expect(screen.getByLabelText("Datasheet URL")).toBeInTheDocument();
  });

  it("shows a built-in component's type label", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ component_type: "amplifier_hemt" }),
          def: null,
        }}
        readOnly={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("HEMT Amplifier")).toBeInTheDocument();
  });

  it("shows the rotation and rotates via the button", async () => {
    const onRotate = vi.fn();
    const { user } = renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ rotation: 90 }),
          def: null,
        }}
        readOnly={false}
        onSave={vi.fn()}
        onRotate={onRotate}
      />,
    );
    expect(screen.getByText("90°")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /rotate 90/i }));
    expect(onRotate).toHaveBeenCalledOnce();
  });

  it("mirrors via the Flip button", async () => {
    const onMirror = vi.fn();
    const { user } = renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ mirrored: false }),
          def: null,
        }}
        readOnly={false}
        onSave={vi.fn()}
        onMirror={onMirror}
      />,
    );
    await user.click(screen.getByRole("button", { name: /mirror/i }));
    expect(onMirror).toHaveBeenCalledOnce();
  });

  it("disables the rotate button when read-only", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ rotation: 0 }),
          def: null,
        }}
        readOnly
        onSave={vi.fn()}
        onRotate={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /rotate 90/i })).toBeDisabled();
  });

  it("shows a custom component's definition name as its type", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ component_type: "custom" }),
          def: makeCustomComponentDef({ name: "My splitter" }),
        }}
        readOnly={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("My splitter")).toBeInTheDocument();
  });

  it("shows line fields", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{ kind: "line", line: makeLine({ id: "l", name: "XY 1" }) }}
        readOnly={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Line" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("XY 1");
    expect(screen.getByLabelText("Show label")).toBeInTheDocument();
  });

  it("shows fridge fields", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "fridge",
          fridge: makeFridge({ id: "f", vendor: "Bluefors" }),
        }}
        readOnly={false}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "Fridge" })).toBeInTheDocument();
    expect(screen.getByLabelText("Vendor")).toHaveValue("Bluefors");
  });
});

describe("PropertiesPanel editing", () => {
  it("debounce-saves a patch (empty → null) after edits", async () => {
    const onSave = vi.fn();
    const { user } = renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "fridge",
          fridge: makeFridge({ id: "f", name: "DR-1", vendor: "Bluefors" }),
        }}
        readOnly={false}
        onSave={onSave}
      />,
    );

    const vendor = screen.getByLabelText("Vendor");
    await user.clear(vendor);
    await user.type(vendor, "Oxford");

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const lastPatch = onSave.mock.calls.at(-1)![0];
    expect(lastPatch).toMatchObject({ name: "DR-1", vendor: "Oxford" });
  });

  it("disables inputs when read-only", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{ kind: "fridge", fridge: makeFridge({ id: "f" }) }}
        readOnly
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByText(/check out to edit/i)).toBeInTheDocument();
  });
});

describe("PropertiesPanel fridge-port linking", () => {
  it("shows a linked-line picker only for a fridge_port, from the given lines", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ id: "p", component_type: "fridge_port" }),
          def: null,
        }}
        readOnly={false}
        onSave={vi.fn()}
        lines={[makeLine({ id: "l1", name: "2B" })]}
      />,
    );
    const picker = screen.getByLabelText("Linked fridge line");
    expect(picker).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "2B" })).toBeInTheDocument();
  });

  it("has no linked-line picker for a non-port component", () => {
    renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ id: "c", component_type: "attenuator" }),
          def: null,
        }}
        readOnly={false}
        onSave={vi.fn()}
        lines={[makeLine({ id: "l1", name: "2B" })]}
      />,
    );
    expect(screen.queryByLabelText("Linked fridge line")).toBeNull();
  });

  it("saves the picked line id (and clears to null via the none option)", async () => {
    const onSave = vi.fn();
    const { user } = renderWithProviders(
      <PropertiesPanel
        selection={{
          kind: "component",
          component: makeComponent({ id: "p", component_type: "fridge_port" }),
          def: null,
        }}
        readOnly={false}
        onSave={onSave}
        lines={[makeLine({ id: "l1", name: "2B" })]}
      />,
    );
    await user.selectOptions(screen.getByLabelText("Linked fridge line"), "l1");
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls.at(-1)![0]).toMatchObject({
      linked_line_id: "l1",
    });
  });
});
