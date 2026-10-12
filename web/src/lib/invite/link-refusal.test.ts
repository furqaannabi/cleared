import { describe, expect, test } from "vitest";
import { linkRefusal } from "./link-refusal";

describe("IN-FR-23 a refused link in words", () => {
  test.each([
    ["youtube_not_connected", "Connect YouTube before you create the link."],
    ["instagram_not_connected", "Connect Instagram before you create the link."],
    ["paypal_email_missing", "Add your PayPal email before you create the link."],
    ["terms_incomplete", "Some terms aren’t finished. Check each post’s amount and deadline."],
  ])("Create link refused with %s", (code, words) => {
    expect(linkRefusal(code, false)).toBe(words);
  });

  test.each([
    ["youtube_not_connected", "Connect YouTube before you send the updated terms."],
    ["instagram_not_connected", "Connect Instagram before you send the updated terms."],
    ["paypal_email_missing", "Add your PayPal email before you send the updated terms."],
    ["terms_incomplete", "Some terms aren’t finished. Check each post’s amount and deadline."],
  ])("Send updated terms refused with %s", (code, words) => {
    expect(linkRefusal(code, true)).toBe(words);
  });

  test("any other refusal has no words of its own", () => {
    expect(linkRefusal("not_allowed", false)).toBeNull();
    expect(linkRefusal(undefined, true)).toBeNull();
  });
});
