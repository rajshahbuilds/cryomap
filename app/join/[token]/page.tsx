import type { Metadata } from "next";
import { JoinForm } from "@/components/workspace/JoinForm";

export const metadata: Metadata = {
  title: "Join workspace · CryoMap",
};

/**
 * Invite redemption page. The middleware guarantees the visitor is signed in
 * (signed-out visitors are sent to login with this path as `next`, then back).
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        CryoMap
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        Join workspace
      </h1>
      <p className="mt-2 text-sm text-muted">
        You&rsquo;ve been invited to collaborate on a CryoMap workspace.
      </p>

      <div className="mt-8">
        <JoinForm token={token} />
      </div>
    </main>
  );
}
