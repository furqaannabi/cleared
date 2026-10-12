/**
 * A Reel's link (Instagram Reels spec IG-FR-14). Pure code. A link is the creator's own text and is
 * never fetched (IG-BR-08): only a short code is taken from it, and only from Instagram's own
 * addresses. Whether that short code is one of the creator's own Reels is for Instagram's API to say.
 */

/** Instagram's own hosts. */
const HOSTS = new Set(["www.instagram.com", "instagram.com"]);
/** The kinds of address a Reel has: its own, and the post's address every Reel also has. */
const KINDS = new Set(["reel", "reels", "p"]);
const SHORT_CODE = /^[A-Za-z0-9_-]{5,40}$/;
const LINK_MAX = 2000;

/** The short code of the Reel a link points to, or nothing if it is not a link to a Reel or a post on Instagram. */
export function shortCodeFrom(link: string): string | undefined {
  const text = link.trim();
  if (!text || text.length > LINK_MAX || !URL.canParse(text)) return undefined;
  const url = new URL(text);
  // The host is compared whole, so a look-alike address, or Instagram's name before an "@", is another site.
  if (url.protocol !== "https:" || url.username || url.password || !HOSTS.has(url.hostname)) return undefined;

  const parts = url.pathname.split("/").filter(Boolean);
  // "/reel/{code}", or the same with the account's name in front.
  const at = parts.length === 2 ? 0 : parts.length === 3 ? 1 : -1;
  if (at === -1 || !KINDS.has(parts[at]!)) return undefined;
  const code = parts[at + 1]!;
  return SHORT_CODE.test(code) ? code : undefined;
}
