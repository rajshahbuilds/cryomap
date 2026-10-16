import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";

afterEach(cleanup);

function Harness({
  handlers,
  canEdit,
}: {
  handlers: Parameters<typeof useKeyboardShortcuts>[0];
  canEdit: boolean;
}) {
  useKeyboardShortcuts(handlers, canEdit);
  return <input aria-label="field" defaultValue="" />;
}

const press = (
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
) =>
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );

describe("useKeyboardShortcuts", () => {
  it("dispatches matched actions to handlers", () => {
    const onDelete = vi.fn();
    render(<Harness handlers={{ delete: onDelete }} canEdit />);

    press(window, "Delete");
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("does not fire while typing in a field", () => {
    const onDelete = vi.fn();
    const { getByLabelText } = render(
      <Harness handlers={{ delete: onDelete }} canEdit />,
    );
    const input = getByLabelText("field");
    input.focus();

    press(input, "Delete");
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("ignores editing shortcuts when not checked out", () => {
    const onDuplicate = vi.fn();
    render(<Harness handlers={{ duplicate: onDuplicate }} canEdit={false} />);

    press(window, "d", { ctrlKey: true });
    expect(onDuplicate).not.toHaveBeenCalled();
  });
});
