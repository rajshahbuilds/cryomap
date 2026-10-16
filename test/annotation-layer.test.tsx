import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders } from "./render";
import { AnnotationLayer } from "@/components/diagram/AnnotationLayer";
import { makeAnnotation } from "./fixtures";

describe("AnnotationLayer", () => {
  it("renders each note's text, one tspan per line", () => {
    const { container } = renderWithProviders(
      <svg>
        <AnnotationLayer
          annotations={[
            makeAnnotation({
              id: "n1",
              text: "line one\nline two",
              x_abs: 40,
              y_abs: 60,
            }),
          ]}
        />
      </svg>,
    );
    const tspans = container.querySelectorAll("text tspan");
    expect([...tspans].map((t) => t.textContent)).toEqual([
      "line one",
      "line two",
    ]);
  });

  it("is inert without handlers (read-only render for exports)", () => {
    const { container } = renderWithProviders(
      <svg>
        <AnnotationLayer
          annotations={[makeAnnotation({ id: "n1", text: "hi" })]}
        />
      </svg>,
    );
    // No selection chrome and the group isn't in the move cursor state.
    expect(container.querySelector("rect")).toBeNull();
    const group = container.querySelector("g > g");
    expect(group?.getAttribute("style") ?? "").not.toContain("move");
  });

  it("selects a note on click when editable", () => {
    const onSelect = vi.fn();
    const { container } = renderWithProviders(
      <svg>
        <AnnotationLayer
          annotations={[makeAnnotation({ id: "n1", text: "hi" })]}
          onSelect={onSelect}
          onMove={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </svg>,
    );
    const group = container.querySelector("g > g")!;
    fireEvent.click(group);
    expect(onSelect).toHaveBeenCalledWith("n1");
  });

  it("shows a delete affordance for the selected note", () => {
    const onDelete = vi.fn();
    const { container } = renderWithProviders(
      <svg>
        <AnnotationLayer
          annotations={[makeAnnotation({ id: "n1", text: "hi" })]}
          selectedId="n1"
          onSelect={() => {}}
          onMove={() => {}}
          onEdit={() => {}}
          onDelete={onDelete}
        />
      </svg>,
    );
    // Selection dashed box present.
    expect(container.querySelector("rect")).not.toBeNull();
    // The × delete control fires onDelete.
    const del = container.querySelector("circle")!.parentElement!;
    fireEvent.click(del);
    expect(onDelete).toHaveBeenCalledWith("n1");
  });

  it("creates a note from a draft on commit, ignoring empty text", () => {
    const onCreate = vi.fn();
    const onCancelDraft = vi.fn();
    const { getByLabelText, rerender } = renderWithProviders(
      <svg>
        <AnnotationLayer
          annotations={[]}
          draftAt={{ x: 20, y: 30 }}
          onCreate={onCreate}
          onCancelDraft={onCancelDraft}
          onSelect={() => {}}
          onMove={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </svg>,
    );
    const textarea = getByLabelText("Annotation text") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hi there" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onCreate).toHaveBeenCalledWith("hi there", 20, 30);
    expect(onCancelDraft).toHaveBeenCalled();

    // A blank draft creates nothing. Clear the draft (unmounts the editor,
    // as the parent does) before opening a fresh one.
    onCreate.mockClear();
    onCancelDraft.mockClear();
    rerender(
      <svg>
        <AnnotationLayer annotations={[]} draftAt={null} onCreate={onCreate} />
      </svg>,
    );
    rerender(
      <svg>
        <AnnotationLayer
          annotations={[]}
          draftAt={{ x: 5, y: 5 }}
          onCreate={onCreate}
          onCancelDraft={onCancelDraft}
          onSelect={() => {}}
          onMove={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </svg>,
    );
    const empty = getByLabelText("Annotation text") as HTMLTextAreaElement;
    fireEvent.keyDown(empty, { key: "Enter" });
    expect(onCreate).not.toHaveBeenCalled();
    expect(onCancelDraft).toHaveBeenCalled();
  });

  it("edits in place on double-click and commits with the new text", () => {
    const onEdit = vi.fn();
    const { container, getByLabelText } = renderWithProviders(
      <svg>
        <AnnotationLayer
          annotations={[makeAnnotation({ id: "n1", text: "old" })]}
          onSelect={() => {}}
          onMove={() => {}}
          onEdit={onEdit}
          onDelete={() => {}}
        />
      </svg>,
    );
    fireEvent.doubleClick(container.querySelector("g > g")!);
    const textarea = getByLabelText("Annotation text") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "new" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onEdit).toHaveBeenCalledWith("n1", "new");
  });
});
