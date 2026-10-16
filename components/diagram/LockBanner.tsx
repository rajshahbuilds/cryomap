interface LockBannerProps {
  holderName: string | null;
  holderAvatarUrl: string | null;
  /** Pre-formatted "since" time (e.g. "2:14 PM"), or null. */
  since: string | null;
  onForceRelease: () => void;
}

/**
 * Non-dismissible amber banner shown when another user holds the checkout.
 * Presentational — fed by `useLock` state in the editor.
 */
export function LockBanner({
  holderName,
  holderAvatarUrl,
  since,
  onForceRelease,
}: LockBannerProps) {
  const name = holderName ?? "another user";

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-status-noisy/30 bg-status-noisy/10 px-4 py-2 text-sm text-foreground"
    >
      <div className="flex min-w-0 items-center gap-2">
        {holderAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar; next/image not warranted
          <img
            src={holderAvatarUrl}
            alt={name}
            width={20}
            height={20}
            referrerPolicy="no-referrer"
            className="h-5 w-5 rounded-full border border-border object-cover"
          />
        ) : null}
        <span className="truncate">
          Checked out by <span className="font-medium">{name}</span>
          {since ? (
            <span className="text-muted"> · since {since}</span>
          ) : null}{" "}
          — read-only.
        </span>
      </div>
      <button
        type="button"
        onClick={onForceRelease}
        className="shrink-0 rounded-md border border-status-noisy/40 bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-background"
      >
        Force release
      </button>
    </div>
  );
}
