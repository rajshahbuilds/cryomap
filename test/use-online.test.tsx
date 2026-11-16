import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { useOnline } from "@/lib/hooks/useOnline";

function setNavigatorOnline(value: boolean | undefined) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  setNavigatorOnline(true);
  vi.restoreAllMocks();
});

describe("useOnline", () => {
  it("reflects the initial navigator state", () => {
    setNavigatorOnline(false);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(false);
  });

  it("assumes online when navigator has no connectivity property", () => {
    setNavigatorOnline(undefined);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
  });

  it.each([true, false])(
    "hydrates without mismatches when browser online is %s",
    async (online) => {
      function Status() {
        return <span>{useOnline() ? "Online" : "Offline"}</span>;
      }
      // Node 22 exposes navigator but not navigator.onLine.
      setNavigatorOnline(undefined);
      const container = document.createElement("div");
      container.innerHTML = renderToString(<Status />);
      expect(container.textContent).toBe("Online");
      document.body.append(container);
      setNavigatorOnline(online);
      const onRecoverableError = vi.fn();
      let root: Root | undefined;
      try {
        await act(async () => {
          root = hydrateRoot(container, <Status />, { onRecoverableError });
        });
        expect(onRecoverableError).not.toHaveBeenCalled();
        expect(container.textContent).toBe(online ? "Online" : "Offline");
      } finally {
        act(() => root?.unmount());
        container.remove();
      }
    },
  );

  it("updates when offline/online events fire", () => {
    setNavigatorOnline(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
