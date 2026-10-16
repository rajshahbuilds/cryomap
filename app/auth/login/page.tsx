import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeRedirectPath } from "@/lib/auth/config";

export const metadata: Metadata = {
  title: "Sign in · CryoMap",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const safeNext = safeRedirectPath(next);

  return (
    <main className="login-hero relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            CryoMap
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
            Wiring diagrams for dilution refrigerators
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-base leading-7 text-muted">
            Document, version, and collaborate on your fridge&rsquo;s wiring —
            with your whole lab.
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface/90 p-8 shadow-lg backdrop-blur">
          <h2 className="text-lg font-semibold text-foreground">Sign in</h2>
          <p className="mt-1 text-sm text-muted">
            Use your Google account to continue.
          </p>
          <div className="mt-6">
            <LoginForm next={safeNext} initialError={Boolean(error)} />
          </div>
        </div>
      </div>
    </main>
  );
}
