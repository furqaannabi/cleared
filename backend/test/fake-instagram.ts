/**
 * A stand-in for Instagram, for tests only. It keeps Instagram's side of a connection: the request
 * that started it, the code it handed back, and the tokens it has given. A test plays the person at
 * Instagram's screen with `approve`, and can revoke access or take Instagram down.
 */
import type { InstagramAccount, InstagramMedia, InstagramPort, InstagramToken } from "../src/instagram/port";

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
  /** Every token an account was read with, in order. */
  readonly reads: string[] = [];
  /** Tokens that no longer work: revoked by the person, or expired. */
  readonly lost = new Set<string>();
  /** Makes every call fail, as Instagram being down would. */
  down = false;
  /** Every search for one of an account's media, and every read of one: whose access, and what for. */
  readonly searches: { token: string; shortCode: string; searched: number }[] = [];
  readonly mediaReads: { token: string; mediaId: string }[] = [];
  /** Each account's own media, newest first, by the account's id. */
  private readonly posts = new Map<string, InstagramMedia[]>();
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
    this.reads.push(token);
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

  async findMedia(token: string, shortCode: string, searched: number): Promise<InstagramMedia | "not_found" | "no_access"> {
    this.searches.push({ token, shortCode, searched });
    if (this.down) throw new Error("Instagram answered 500 for an account's media");
    const person = this.tokens.get(token);
    if (!person || this.lost.has(token)) return "no_access";
    return (this.posts.get(person.id) ?? []).slice(0, searched).find((media) => media.shortCode === shortCode) ?? "not_found";
  }

  async media(token: string, mediaId: string): Promise<InstagramMedia | "not_found" | "no_access"> {
    this.mediaReads.push({ token, mediaId });
    if (this.down) throw new Error("Instagram answered 500 for one of an account's media");
    const person = this.tokens.get(token);
    if (!person || this.lost.has(token)) return "no_access";
    return (this.posts.get(person.id) ?? []).find((media) => media.id === mediaId) ?? "not_found";
  }

  // What a test controls

  /**
   * A post on an account, newest first. Left alone it is a Reel whose video can be fetched, with no
   * caption. Returns it, so a test can read its id.
   */
  hasPost(accountId: string, shortCode: string, post: Partial<InstagramMedia> = {}): InstagramMedia {
    const media: InstagramMedia = {
      id: `1800000000000${String(++this.sequence).padStart(4, "0")}`,
      shortCode,
      isReel: true,
      link: `https://www.instagram.com/reel/${shortCode}/`,
      postedAt: this.now(),
      caption: "",
      videoUrl: `https://video.cdninstagram.test/${shortCode}.mp4?sig=signed`,
      ...post,
    };
    this.posts.set(accountId, [media, ...(this.posts.get(accountId) ?? [])]);
    return media;
  }

  /** Changes a post, as its owner would in Instagram: a new caption, say. */
  editPost(accountId: string, shortCode: string, change: Partial<InstagramMedia>): void {
    this.posts.set(accountId, (this.posts.get(accountId) ?? []).map((media) => (media.shortCode === shortCode ? { ...media, ...change } : media)));
  }

  /** Deletes a post, as its owner could at any time. */
  removePost(accountId: string, shortCode: string): void {
    this.posts.set(accountId, (this.posts.get(accountId) ?? []).filter((media) => media.shortCode !== shortCode));
  }

  /** A token that already works for this person, as one stored by an earlier connection would. */
  has(token: string, person: InstagramPerson): void {
    this.tokens.set(token, person);
  }

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
