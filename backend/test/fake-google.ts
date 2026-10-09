/**
 * A stand-in for Google, for tests only. It keeps Google's side of a sign-in: the request that started
 * it, the code it handed back, and the checks Google makes when the code is exchanged. A test plays the
 * person at Google's screen with `approve`.
 */
import type { GoogleExchange, GooglePort, GoogleScope } from "../src/google/port";

export interface Person {
  googleId: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  /** Their YouTube channel, or null if the account has none. */
  channel?: { id: string; name: string } | null;
  /** False if they untick YouTube access on Google's screen. */
  grantsYoutube?: boolean;
}

interface Started {
  scope: GoogleScope;
  state: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
}

const challengeOf = (verifier: string) =>
  Buffer.from(new Bun.CryptoHasher("sha256").update(verifier).digest()).toString("base64url");

export class FakeGoogle implements GooglePort {
  /** Every sign-in that was started, in order. */
  readonly started: Started[] = [];
  private readonly codes = new Map<string, { started: Started; person: Person }>();
  private readonly tokens = new Map<string, Person>();
  private failNextExchange = false;
  private sequence = 0;

  signInUrl(input: Started): string {
    this.started.push(input);
    return `https://accounts.google.test/auth?state=${encodeURIComponent(input.state)}&scope=${input.scope}`;
  }

  async exchange(input: { code: string; codeVerifier: string; nonce: string; redirectUri: string }): Promise<GoogleExchange> {
    const issued = this.codes.get(input.code);
    // A code works once.
    this.codes.delete(input.code);
    if (this.failNextExchange) {
      this.failNextExchange = false;
      return { ok: false };
    }
    if (!issued) return { ok: false };
    const { started, person } = issued;
    if (challengeOf(input.codeVerifier) !== started.codeChallenge) return { ok: false };
    if (input.redirectUri !== started.redirectUri || input.nonce !== started.nonce) return { ok: false };
    const youtube = started.scope === "youtube" && person.grantsYoutube !== false;
    const accessToken = `access-${++this.sequence}`;
    this.tokens.set(accessToken, person);
    return {
      ok: true,
      identity: { googleId: person.googleId, name: person.name, email: person.email, emailVerified: person.emailVerified ?? true },
      accessToken,
      refreshToken: started.scope === "youtube" ? `refresh-${this.sequence}` : undefined,
      youtube,
    };
  }

  async channel(accessToken: string) {
    const person = this.tokens.get(accessToken);
    if (!person) return "unavailable" as const;
    return person.channel ?? ("none" as const);
  }

  // What a test controls

  /** The person approves on Google's screen. Returns the code Google sends the browser back with. */
  approve(state: string, person: Person): string {
    const started = this.started.find((entry) => entry.state === state);
    if (!started) throw new Error("No sign-in was started with that state");
    const code = `code-${++this.sequence}`;
    this.codes.set(code, { started, person });
    return code;
  }

  /** Google refuses the next code. */
  refuseNextExchange(): void {
    this.failNextExchange = true;
  }
}
