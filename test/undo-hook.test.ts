import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { useUndoRedo } from "@/lib/hooks/useUndoRedo";

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({}),
}));
afterEach(cleanup);
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
describe("serialized edit history", () => {
  it("runs rapid edits and an immediate undo in order", async () => {
    const gate = deferred(),
      events: string[] = [];
    const { result } = renderHook(() => useUndoRedo(vi.fn()));
    act(() => {
      result.current.apply({
        redo: async () => {
          events.push("first starts");
          await gate.promise;
          events.push("first ends");
        },
        undo: async () => {
          events.push("undo first");
        },
      });
      result.current.apply({
        redo: async () => {
          events.push("second");
        },
        undo: async () => {
          events.push("undo second");
        },
      });
      result.current.undo();
    });
    await waitFor(() => expect(events).toEqual(["first starts"]));
    expect(result.current.pending).toBe(true);
    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(events).toEqual([
      "first starts",
      "first ends",
      "second",
      "undo second",
    ]);
    expect(result.current.canRedo).toBe(true);
  });
  it("keeps a failed undo on the undo stack and continues processing edits", async () => {
    const error = vi.fn(),
      undo = vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue(undefined);
    const { result } = renderHook(() => useUndoRedo(vi.fn(), error));
    act(() => result.current.apply({ redo: async () => {}, undo }));
    await waitFor(() => expect(result.current.canUndo).toBe(true));
    act(() => result.current.undo());
    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    act(() => result.current.undo());
    await waitFor(() => expect(result.current.canRedo).toBe(true));
  });
  it("rolls back a failed optimistic save and leaves history clean", async () => {
    const update = vi.fn(),
      reload = vi.fn(),
      error = vi.fn();
    const optimisticRedo = vi.fn((state) => state),
      optimisticUndo = vi.fn((state) => state);
    const { result } = renderHook(() => useUndoRedo(reload, error, update));
    act(() =>
      result.current.apply({
        optimisticRedo,
        optimisticUndo,
        redo: async () => {
          throw new Error("offline");
        },
        undo: async () => {},
      }),
    );
    await waitFor(() => expect(error).toHaveBeenCalledOnce());
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(update.mock.calls.map((call) => call[0])).toEqual([
      optimisticRedo,
      optimisticUndo,
    ]);
    expect(reload).toHaveBeenCalledOnce();
    expect(result.current.canUndo).toBe(false);
  });
  it("does not repopulate history after a reset while a request is in flight", async () => {
    const gate = deferred();
    const { result } = renderHook(() => useUndoRedo(vi.fn()));
    act(() =>
      result.current.apply({ redo: () => gate.promise, undo: async () => {} }),
    );
    await waitFor(() => expect(result.current.pending).toBe(true));
    act(() => result.current.reset());
    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.canUndo).toBe(false);
  });
});
