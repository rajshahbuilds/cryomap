import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderWithProviders, screen } from "./render";
import { SignalMatches } from "@/components/diagram/SignalMatches";
import {
  makeComponent,
  makeDiagramState,
  makeLine,
  makeSheet,
} from "./fixtures";

afterEach(cleanup);

describe("signal navigation", () => {
  it("lists a matching line terminal and jumps to its page", async () => {
    const onJump = vi.fn();
    const state = makeDiagramState({
      sheets: [makeSheet({ id: "cryo", name: "Cryo", kind: "fridge" })],
      lines: [makeLine({ id: "line", sheet_id: "cryo", name: "Q1" })],
      components: [
        makeComponent({
          id: "port",
          component_type: "output_port",
          label: "Q1",
        }),
      ],
    });
    const { user } = renderWithProviders(
      <SignalMatches state={state} componentId="port" onJump={onJump} />,
    );
    await user.click(screen.getByRole("button", { name: "Cryo · Input: Q1" }));
    expect(onJump).toHaveBeenCalledWith("line", "cryo");
    expect(screen.getByText(/Wires are drawn separately/)).toBeInTheDocument();
  });
  it("prompts for a name and does not offer blank-name matches", () => {
    const state = makeDiagramState({
      components: [
        makeComponent({
          id: "port",
          component_type: "bidir_port",
          label: null,
        }),
      ],
    });
    renderWithProviders(
      <SignalMatches state={state} componentId="port" onJump={vi.fn()} />,
    );
    expect(screen.getByText(/Name this port/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
