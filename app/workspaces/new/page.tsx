import type { Metadata } from "next";
import { WorkspaceForm } from "@/components/workspace/WorkspaceForm";

export const metadata: Metadata = {
  title: "New workspace · CryoMap",
};

/** New-workspace page. Route protection is enforced by the middleware. */
export default function NewWorkspacePage() {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-muted">
        CryoMap
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
        New workspace
      </h1>
      <p className="mt-2 text-sm text-muted">
        A workspace (lab) holds your fridges and the people who can access them.
        You&rsquo;ll be its admin.
      </p>

      <div className="mt-8">
        <WorkspaceForm />
      </div>
    </main>
  );
}
