"use client";

import { useProfile } from "@/lib/hooks/useProfile";
import { UserMenu } from "./UserMenu";

/** Client container that feeds the presentational UserMenu from `useProfile`. */
export function AccountMenu() {
  const { profile, loading } = useProfile();
  return <UserMenu profile={profile} loading={loading} />;
}
