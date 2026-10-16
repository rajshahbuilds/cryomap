import { describe, it, expect } from "vitest";
import { render, screen, userEvent } from "./render";
import { ToastProvider, useToast } from "@/components/toast/ToastProvider";

function Harness() {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.error("Something broke")}>fail</button>
      <button onClick={() => toast.success("Saved")}>ok</button>
    </div>
  );
}

const setup = () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Harness />
    </ToastProvider>,
  );
  return { user };
};

describe("ToastProvider", () => {
  it("shows a toast when triggered", async () => {
    const { user } = setup();
    await user.click(screen.getByText("fail"));
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("stacks multiple toasts", async () => {
    const { user } = setup();
    await user.click(screen.getByText("fail"));
    await user.click(screen.getByText("ok"));
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("dismisses a toast via its close button", async () => {
    const { user } = setup();
    await user.click(screen.getByText("fail"));
    await user.click(
      screen.getByRole("button", { name: /dismiss notification/i }),
    );
    expect(screen.queryByText("Something broke")).not.toBeInTheDocument();
  });

  it("throws when useToast is used outside a provider", () => {
    expect(() => render(<Harness />)).toThrow(/within a ToastProvider/i);
  });
});
