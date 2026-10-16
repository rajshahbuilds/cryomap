/**
 * Client-side JSON export of a diagram snapshot. Used by the lock-expiry
 * recovery flow so a user whose checkout lapsed mid-edit can still rescue their
 * work as a file.
 */

/**
 * A filesystem-friendly `<slug>-YYYY-MM-DD.<ext>` name for an export.
 * Defaults to `json`; pass `png`/`pdf` for image exports.
 */
export function exportFilename(
  name: string | null | undefined,
  ext = "json",
  now: Date = new Date(),
): string {
  const slug =
    (name ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "diagram";
  const date = now.toISOString().slice(0, 10);
  return `${slug}-${date}.${ext}`;
}

/** Trigger a browser download of `data` serialized as pretty-printed JSON. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
