/**
 * Everything the backend asks of Google, as one interface (deal set-up spec, "A Google port"): signing a
 * creator in, and reading their YouTube channel with read-only access. The real one calls Google; tests
 * use a fake.
 */

/** identity: who the person is, and nothing else. youtube: that, plus read-only access to their YouTube account. */
export type GoogleScope = "identity" | "youtube";

export interface GoogleIdentity {
  /** Google's own id for the account. It never changes, unlike the email. */
  googleId: string;
  name: string;
  email: string;
  emailVerified: boolean;
}

export type GoogleExchange =
  | {
      ok: true;
      identity: GoogleIdentity;
      accessToken: string;
      /** Given only when the person was asked for consent to offline access. */
      refreshToken?: string;
      /** Whether read-only YouTube access was granted. The person can untick it on Google's screen. */
      youtube: boolean;
    }
  /** Google would not exchange the code, or its answer could not be verified. */
  | { ok: false };

export interface GooglePort {
  /** The address at Google the browser is sent to. */
  signInUrl(input: { scope: GoogleScope; state: string; nonce: string; codeChallenge: string; redirectUri: string }): string;
  /**
   * Exchanges the one-time code Google sent the browser back with. The identity is returned only if
   * Google's signature on it checks out and it carries the nonce this sign-in started with (DS-FR-01).
   */
  exchange(input: { code: string; codeVerifier: string; nonce: string; redirectUri: string }): Promise<GoogleExchange>;
  /** The person's own YouTube channel, read with their access token. */
  channel(accessToken: string): Promise<{ id: string; name: string } | "none" | "unavailable">;
}
