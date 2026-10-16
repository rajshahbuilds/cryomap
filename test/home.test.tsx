import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { redirect } from "next/navigation";
import Home from "@/app/page";

describe("Home", () => {
  it("redirects the root path to the fridge list", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/fridges");
  });
});
