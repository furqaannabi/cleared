/**
 * Everything the backend asks of Instagram to connect an account (Instagram Reels spec IG-FR-02 to
 * IG-FR-06): the sign-in address, exchanging the code it comes back with, reading the account, and
 * renewing its token. The real one calls Instagram's API; tests use a stand-in. Only reading is ever
 * asked for (IG-BR-01).
 */

/** An Instagram account as its own API describes it. */
export interface InstagramAccount {
  /** Instagram's own id for the account. */
  id: string;
  /** The account's name. Untrusted text (IG-BR-09). */
  username: string;
  /** Whether it is a professional account: a business or a creator account. Only those can be connected (IG-FR-03). */
  professional: boolean;
}

/** A token and when it ends. It is never logged and never sent to the browser (IG-BR-02). */
export interface InstagramToken {
  token: string;
  expiresAt: Date;
}

/** One of an account's own media, as much of it as the backend uses (IG-FR-15, IG-FR-19). */
export interface InstagramMedia {
  /** Instagram's own id for it. */
  id: string;
  /** The short code in its link. */
  shortCode: string;
  isReel: boolean;
  /** Instagram's own link to it. Absent if Instagram gave none that is on its own address. */
  link?: string;
  /** Instagram's own date for it. Kept as evidence; it decides nothing. */
  postedAt?: Date;
  /** Its caption. Untrusted text (IG-BR-09). */
  caption: string;
  /** Where its video can be fetched. Absent when Instagram gives none, as for a Reel with licensed music. Never logged (IG-BR-12). */
  videoUrl?: string;
}

export interface InstagramPort {
  /** The address at Instagram the browser is sent to, asking for one permission: to read the account's profile and media. */
  signInUrl(input: { state: string; redirectUri: string }): string;
  /** Exchanges the one-time code Instagram sent the browser back with for a token that lasts 60 days. */
  exchange(input: { code: string; redirectUri: string }): Promise<({ ok: true } & InstagramToken) | { ok: false }>;
  /** The account a token belongs to. "no_access" when the token no longer works. A failure of Instagram itself is thrown. */
  account(token: string): Promise<InstagramAccount | "no_access">;
  /** A token for 60 more days, in place of one that still works. "no_access" when it does not. A failure of Instagram itself is thrown. */
  renew(token: string): Promise<InstagramToken | "no_access">;
  /**
   * The one of the account's own media with this short code, looked for among its `searched` most
   * recent, newest first (IG-FR-15). A link to anyone else's media can never be found this way
   * (IG-BR-07). "no_access" when the token no longer works. A failure of Instagram itself is thrown.
   */
  findMedia(token: string, shortCode: string, searched: number): Promise<InstagramMedia | "not_found" | "no_access">;
  /** One of the account's own media, by Instagram's id for it (IG-FR-19). "not_found" when it is gone. A failure of Instagram itself is thrown. */
  media(token: string, mediaId: string): Promise<InstagramMedia | "not_found" | "no_access">;
}
