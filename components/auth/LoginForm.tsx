"use client";

import { useState } from "react";
import { signInWithGoogle } from "@/lib/auth/client";
import { GoogleSignInButton } from "./GoogleSignInButton";

interface LoginFormProps {
  /** Path to return to after a successful sign-in. */
  next?: string;
  /** Show a generic failure message (e.g. when the callback bounced back). */
  initialError?: boolean;
  /** Small header-sized button with the error right-aligned beneath it. */
  compact?: boolean;
}

/** Stateful wrapper that drives the Google OAuth flow. */
export function LoginForm({
  next,
  initialError = false,
  compact = false,
}: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    initialError ? "Sign-in failed. Please try again." : "",
  );

  async function handleSignIn() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle(next);
      // On success the browser navigates to Google; keep the spinner up.
    } catch {
      setError("Could not start Google sign-in. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "flex flex-col items-end gap-2" : "space-y-3"}>
      <GoogleSignInButton
        onClick={handleSignIn}
        loading={loading}
        compact={compact}
      />
      {error ? (
        <p
          role="alert"
          className={
            compact
              ? "max-w-xs text-right text-sm text-status-broken"
              : "text-sm text-status-broken"
          }
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
