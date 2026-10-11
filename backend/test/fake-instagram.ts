/**
 * A stand-in for Instagram, for tests only. It keeps Instagram's side of a connection: the request
 * that started it, the code it handed back, and the tokens it has given. A test plays the person at
 * Instagram's screen with `approve`, and can revoke access or take Instagram down.
 */
import type { InstagramAccount, InstagramPort, InstagramToken } from "../src/instagram/port";

export interface InstagramPerson {
  id: string;
  username: string;
  /** False for a personal account, which cannot be connected. */
  professional?: boolean;
}

const DAY_MS = 24 * 3600 * 1000;

export class FakeInstagram implements InstagramPort {
  constructor(private readonly now: () => Date = () => new Date()) {}

  /** Every connection that was started, in order. */
  readonly started: { state: string; redirectUri: string }[] = [];
  /** Every token it was asked to renew, in order. */
  readonly renewals: string[] = [];
  /** Tokens that no longer work: revoked by the person, or expired. */
  readonly lost = new Set<string>();
  /** Makes every call fail, as Instagram being down would. */
  down = false;
  private readonly codes = new Map<string, { redirectUri: string; person: InstagramPerson }>();
  private readonly tokens = new Map<string, InstagramPerson>();
  private sequence = 0;

  signInUrl(input: { state: string; redirectUri: string }): string {
    this.started.push(input);
    return `https://www.instagram.test/oauth/authorize?state=${encodeURIComponent(input.state)}&scope=instagram_business_basic`;
  }

  async exchange(input: { code: string; redirectUri: string }): Promise<({ ok: true } & InstagramToken) | { ok: false }> {
    const issued = this.codes.get(input.code);
    // A code works once, and only for the address it was asked for.
    this.codes.delete(input.code);
    if (this.down || !issued || issued.redirectUri !== input.redirectUri) return { ok: false };
    return { ok: true, ...this.issue(issued.person) };
  }

  async account(token: string): Promise<InstagramAccount | "no_access"> {
    if (this.down) throw new Error("Instagram answered 500 for an account");
    const person = this.tokens.get(token);
    if (!person || this.lost.has(token)) return "no_access";
    return { id: person.id, username: person.username, professional: person.professional !== false };
  }

  async renew(token: string): Promise<InstagramToken | "no_access"> {
    this.renewals.push(token);
    if (this.down) throw new Error("Instagram answered 503 for a renewed token");
    const person = this.tokens.get(token);
    if (!person || this.lost.has(token)) return "no_access";
    return this.issue(person);
  }

  // What a test controls

  /** The person approves at Instagram's screen. Returns the code Instagram sends the browser back with. */
  approve(state: string, person: InstagramPerson): string {
    const started = this.started.find((each) => each.state === state);
    if (!started) throw new Error("No connection was started with that state");
    const code = `ig-code-${++this.sequence}`;
    this.codes.set(code, { redirectUri: started.redirectUri, person });
    return code;
  }

  private issue(person: InstagramPerson): InstagramToken {
    const token = `ig-token-${person.username}-${++this.sequence}`;
    this.tokens.set(token, person);
    return { token, expiresAt: new Date(this.now().getTime() + 60 * DAY_MS) };
  }
}
