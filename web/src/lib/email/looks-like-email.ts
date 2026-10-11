const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether typed text looks like an email: one @, a dot after it, no spaces,
 * at most 254 characters. The API checks again.
 *
 * @see docs/specs/creator-invite-frd.md IN-FR-12; docs/specs/confirm-and-hold-frd.md CH-FR-28
 */
export const looksLikeEmail = (text: string) => text.length <= 254 && EMAIL.test(text);
