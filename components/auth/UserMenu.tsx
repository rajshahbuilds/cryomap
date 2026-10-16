import Link from "next/link";
import type { ProfileView } from "@/lib/hooks/useProfile";
import { signOut } from "@/lib/auth/actions";

/** Two-letter initials from a display name, or the email's first letter. */
function initialsFor(profile: ProfileView | null): string {
  const name = profile?.displayName?.trim();
  if (name) {
    const [first, second] = name.split(/\s+/);
    return `${first[0]}${second?.[0] ?? ""}`.toUpperCase();
  }
  const email = profile?.email?.trim();
  return email ? email[0].toUpperCase() : "?";
}

function Avatar({ profile }: { profile: ProfileView | null }) {
  const label = profile?.displayName?.trim() || profile?.email || "Account";

  if (profile?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Google avatar; next/image config not warranted here
      <img
        src={profile.avatarUrl}
        alt={label}
        width={32}
        height={32}
        referrerPolicy="no-referrer"
        className="h-8 w-8 rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-muted"
    >
      {initialsFor(profile)}
    </span>
  );
}

interface UserMenuProps {
  profile: ProfileView | null;
  loading?: boolean;
}

/** Account dropdown: avatar button opening name/email + sign out. */
export function UserMenu({ profile, loading = false }: UserMenuProps) {
  const name = profile?.displayName?.trim() || profile?.email || "Account";
  const showEmail = Boolean(profile?.displayName?.trim() && profile?.email);

  return (
    <details className="relative">
      <summary
        aria-label="Account menu"
        className="flex cursor-pointer list-none items-center rounded-full transition [&::-webkit-details-marker]:hidden"
      >
        <Avatar profile={profile} />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-border bg-surface p-1 shadow-md">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium text-foreground">
            {loading && !profile ? "…" : name}
          </p>
          {showEmail ? (
            <p className="truncate text-xs text-muted">{profile?.email}</p>
          ) : null}
        </div>
        <div className="my-1 h-px bg-border" />
        <Link
          href="/account"
          className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-background"
        >
          Account settings
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-foreground transition hover:bg-background"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
