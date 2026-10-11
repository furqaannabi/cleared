/**
 * A file's size as a creator reads it: "412 MB", "1.2 GB".
 *
 * @see docs/specs/creator-draft-check-frd.md DC-FR-45 (1.18)
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
