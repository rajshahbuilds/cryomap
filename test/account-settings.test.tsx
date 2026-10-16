import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "./render";

const deleteAccount = vi.fn();
vi.mock("@/app/account/actions", () => ({
  deleteAccount: (ids: string[]) => deleteAccount(ids),
}));

import { AccountSettings } from "@/components/auth/AccountSettings";

const SHARED = { id: "ws-1", name: "Lab One", otherMembers: 3, fridgeCount: 2 };
const SOLO = { id: "ws-2", name: "Scratch", otherMembers: 0, fridgeCount: 1 };

beforeEach(() => {
  deleteAccount.mockReset();
  deleteAccount.mockResolvedValue({});
});

async function openConfirm(soleAdminWorkspaces = [SHARED, SOLO]) {
  const user = userEvent.setup();
  renderWithProviders(
    <AccountSettings
      email="ada@example.com"
      hasWorkspace
      soleAdminWorkspaces={soleAdminWorkspaces}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Delete account" }));
  return user;
}

describe("AccountSettings", () => {
  it("warns about sole-admin workspaces and links to hand off admin", async () => {
    await openConfirm();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/only admin of these workspaces/i);
    expect(alert).toHaveTextContent("Lab One");
    expect(alert).toHaveTextContent("3 other members");
    expect(alert).toHaveTextContent("Scratch");
    expect(alert).toHaveTextContent("only you");
    // Only the shared workspace offers the hand-off link.
    const links = screen.getAllByRole("link", {
      name: /make someone else admin/i,
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/workspaces/ws-1/settings");
  });

  it("shows no warning when the user isn't a sole admin", async () => {
    await openConfirm([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("requires typing the confirm word, then deletes with confirmed workspaces", async () => {
    const user = await openConfirm();
    const submit = screen.getByRole("button", {
      name: /delete account and 2 workspaces/i,
    });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/to confirm/i), "delete");
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(deleteAccount).toHaveBeenCalledWith(["ws-1", "ws-2"]);
  });

  it("toasts when deletion fails", async () => {
    deleteAccount.mockResolvedValue({ error: "Couldn’t delete your account" });
    const user = await openConfirm([]);
    await user.type(screen.getByLabelText(/to confirm/i), "delete");
    await user.click(screen.getByRole("button", { name: "Delete account" }));
    expect(
      await screen.findByText("Couldn’t delete your account"),
    ).toBeInTheDocument();
  });
});
