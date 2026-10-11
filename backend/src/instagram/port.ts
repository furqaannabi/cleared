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

export interface InstagramPort {
  /** The address at Instagram the browser is sent to, asking for one permission: to read the account's profile and media. */
  signInUrl(input: { state: string; redirectUri: string }): string;
  /** Exchanges the one-time code Instagram sent the browser back with for a token that lasts 60 days. */
  exchange(input: { code: string; redirectUri: string }): Promise<({ ok: true } & InstagramToken) | { ok: false }>;
  /** The account a token belongs to. "no_access" when the token no longer works. A failure of Instagram itself is thrown. */
  account(token: string): Promise<InstagramAccount | "no_access">;
  /** A token for 60 more days, in place of one that still works. "no_access" when it does not. A failure of Instagram itself is thrown. */
  renew(token: string): Promise<InstagramToken | "no_access">;
}
