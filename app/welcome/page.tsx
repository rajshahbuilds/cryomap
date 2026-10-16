import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { OnboardingScreen } from "@/components/workspace/OnboardingScreen";
import { LOGIN_PATH } from "@/lib/auth/config";
import { workspacesRepo } from "@/lib/repositories";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Welcome · CryoMap",
};

/** First-run onboarding. Users who already have a workspace skip straight in. */
export default async function WelcomePage() {
  const db = await createSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(LOGIN_PATH);

  const workspaces = await workspacesRepo(db).list();
  if (workspaces.length > 0) redirect("/fridges");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted">
            CryoMap
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
            Welcome
          </h1>
          <p className="mt-2 text-sm text-muted">
            Fridges live inside a workspace (your lab). Create one, or join an
            existing workspace to get started.
          </p>
        </div>
        <AccountMenu />
      </header>

      <div className="mt-10">
        <OnboardingScreen />
      </div>
    </main>
  );
}
