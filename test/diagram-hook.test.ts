import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDiagram } from "@/lib/hooks/useDiagram";
import { makeComponent, makeDiagramState, makeFridge } from "./fixtures";

const mocks = vi.hoisted(() => ({ load: vi.fn(), getFridge: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({}),
}));
vi.mock("@/lib/diagram/load", () => ({ loadDiagramState: mocks.load }));
vi.mock("@/lib/repositories", () => ({
  fridgesRepo: () => ({ get: mocks.getFridge }),
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
describe("diagram reconciliation", () => {
  it("does not let an older load overwrite an immediate edit", async () => {
    const fridge = makeFridge(),
      component = makeComponent({ label: "old" });
    const state = makeDiagramState({ components: [component] });
    mocks.getFridge.mockResolvedValue(fridge);
    mocks.load.mockResolvedValueOnce(state);
    const { result } = renderHook(() => useDiagram(fridge.id));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    let finish!: (value: typeof state) => void;
    mocks.load.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    act(() => result.current.reload());
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
    act(() =>
      result.current.updateState((current) => ({
        ...current,
        components: [{ ...component, label: "new" }],
      })),
    );
    await act(async () => {
      finish(state);
    });
    expect(result.current.state?.components[0].label).toBe("new");
    mocks.load.mockResolvedValueOnce({
      ...state,
      components: [{ ...component, label: "confirmed" }],
    });
    act(() => result.current.reload());
    await waitFor(() =>
      expect(result.current.state?.components[0].label).toBe("confirmed"),
    );
  });
});
