/**
 * SI-BR-02: a `next` path only when it is a path on this site: a single
 * leading slash, no scheme, no `//` or `/\` that a browser would read as
 * another host. Anything else is dropped.
 *
 * @see docs/specs/sign-in-frd.md SI-FR-06, SI-BR-02
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\s]/.test(next)) return null;
  return next;
}

/** The sign-in page, carrying where the creator was going when it is safe (SI-FR-06). */
export function signInPath(next: string | null | undefined): string {
  const safe = safeNext(next);
  return safe ? `/sign-in?next=${encodeURIComponent(safe)}` : "/sign-in";
}
