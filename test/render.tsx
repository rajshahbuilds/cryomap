import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { ToastProvider } from "@/components/toast/ToastProvider";

/**
 * Central render helper for component tests.
 *
 * App-wide providers (toast notifications today; Supabase session, etc. as they
 * arrive) are wrapped here so every test shares one setup instead of re-wiring
 * providers per file.
 */
function Providers({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Providers, ...options }),
  };
}

export * from "@testing-library/react";
export { userEvent };
