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
    <div className="login-hero relative flex flex-1 flex-col overflow-hidden">
      <header className="flex items-start justify-end px-6 py-4">
        <LoginForm compact next={safeNext} initialError={Boolean(error)} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
        <div className="w-full max-w-2xl text-center">
          <h1 className="text-6xl font-semibold tracking-tight text-foreground sm:text-7xl">
            CryoMap
          </h1>
          <p className="mt-5 text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
            Wiring diagrams for dilution refrigerators
          </p>
          <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted">
            Document, version, and collaborate on your fridge&rsquo;s wiring —
            with your whole lab.
          </p>
        </div>
      </main>
    </div>
  );
}
