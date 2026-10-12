/**
 * A Reel's link (Instagram Reels spec IG-FR-14, IG-BR-08): pure code from the text a creator pasted to
 * the Reel's short code, or nothing. The link is never fetched.
 */
import { describe, expect, test } from "bun:test";
import { shortCodeFrom } from "./reel-link";

describe("IG-FR-14 a link to a Reel or a post gives its short code", () => {
  test.each([
    ["a Reel's link", "https://www.instagram.com/reel/DAbC1dEfGhI/", "DAbC1dEfGhI"],
    ["without the last slash", "https://www.instagram.com/reel/DAbC1dEfGhI", "DAbC1dEfGhI"],
    ["as the app shares it, with its tracking added", "https://www.instagram.com/reel/DAbC1dEfGhI/?igsh=MXg0abc123&utm_source=ig_web_copy_link", "DAbC1dEfGhI"],
    ["the plural form", "https://www.instagram.com/reels/DAbC1dEfGhI/", "DAbC1dEfGhI"],
    ["a post's link, which a Reel also has", "https://www.instagram.com/p/DAbC1dEfGhI/", "DAbC1dEfGhI"],
    ["with the account's name in front", "https://www.instagram.com/sam.rivera/reel/DAbC1dEfGhI/", "DAbC1dEfGhI"],
    ["without www", "https://instagram.com/reel/DAbC1dEfGhI/", "DAbC1dEfGhI"],
    ["a short code with a dash and an underscore", "https://www.instagram.com/reel/C-x_9aB2kLm/", "C-x_9aB2kLm"],
    ["with spaces around it, as pasted", "  https://www.instagram.com/reel/DAbC1dEfGhI/  ", "DAbC1dEfGhI"],
  ])("%s", (_what, link, code) => {
    expect(shortCodeFrom(link)).toBe(code);
  });
});

describe("IG-FR-14, IG-BR-08 anything else is not a Reel's link", () => {
  test.each([
    ["text that is not a link", "my new reel"],
    ["nothing", ""],
    ["a profile", "https://www.instagram.com/sam.rivera/"],
    ["a story", "https://www.instagram.com/stories/sam.rivera/3212345678901234567/"],
    ["the Reels tab itself", "https://www.instagram.com/reels/"],
    ["a YouTube link", "https://youtu.be/dQw4w9WgXcQ"],
    ["another site whose name starts with Instagram's", "https://www.instagram.com.evil.example/reel/DAbC1dEfGhI/"],
    ["another site with Instagram's name before an @", "https://www.instagram.com@evil.example/reel/DAbC1dEfGhI/"],
    ["another site with Instagram's address in its path", "https://evil.example/www.instagram.com/reel/DAbC1dEfGhI/"],
    ["a link that is not https", "http://www.instagram.com/reel/DAbC1dEfGhI/"],
    ["a script dressed as a link", "javascript:alert('https://www.instagram.com/reel/DAbC1dEfGhI/')"],
    ["a short code with something that is not one", "https://www.instagram.com/reel/DAbC1d<script>/"],
    ["a short code that tries to climb out of its place", "https://www.instagram.com/reel/..%2F..%2Fme/"],
    ["a short code far too long to be one", `https://www.instagram.com/reel/${"A".repeat(60)}/`],
    ["a link far too long to be one", `https://www.instagram.com/reel/DAbC1dEfGhI/?x=${"a".repeat(3000)}`],
  ])("%s", (_what, link) => {
    expect(shortCodeFrom(link)).toBeUndefined();
  });
});
