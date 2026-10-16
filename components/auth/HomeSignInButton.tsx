"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth/client";
import { safeRedirectPath } from "@/lib/auth/config";

/** Starts Google OAuth directly from the public homepage header. */
export function HomeSignInButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignIn() {
    setLoading(true);
    setError("");

    try {
      const requestedNext = new URLSearchParams(window.location.search).get(
        "next",
      );
      const next = requestedNext
        ? safeRedirectPath(requestedNext, "/fridges")
        : undefined;
      await signInWithGoogle(next);
      // On success the browser navigates to Google; keep the pending state up.
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleSignIn}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-ice-deep px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(11,37,69,0.16)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      {error ? (
        <p
          role="alert"
          className="max-w-xs text-right text-sm text-status-broken"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
