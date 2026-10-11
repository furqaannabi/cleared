import { describe, expect, test } from "vitest";
import { connectHref, readConnectResult } from "./connect-result";

describe("IN-FR-11 (1.3) connecting through the backend", () => {
  test("the link goes to the backend's connect route, returning to this page marked with the platform", () => {
    expect(connectHref("https://api.example", "youtube", "/deals/deal_pine/invite")).toBe(
      "https://api.example/connect/youtube?next=%2Fdeals%2Fdeal_pine%2Finvite%3Fconnecting%3Dyoutube",
    );
    expect(connectHref("https://api.example", "instagram", "/welcome")).toBe("https://api.example/connect/instagram?next=%2Fwelcome%3Fconnecting%3Dinstagram");
  });

  test("connected: the platform, no message, and the address cleaned", () => {
    expect(readConnectResult("?connecting=youtube&connected=youtube")).toEqual({ platform: "youtube", message: null, rest: "" });
  });

  test("each failure has its message on its platform's card", () => {
    const yt = (r: string) => readConnectResult(`?connecting=youtube&connect=${r}`)?.message;
    const ig = (r: string) => readConnectResult(`?connecting=instagram&connect=${r}`)?.message;
    expect(yt("failed")).toBe("We couldn’t connect YouTube. Try again.");
    expect(ig("failed")).toBe("We couldn’t connect Instagram. Try again.");
    expect(yt("declined")).toBe("YouTube isn’t connected, because access wasn’t allowed. Cleared only reads your channel.");
    expect(ig("declined")).toBe("Instagram isn’t connected, because access wasn’t allowed. Cleared only reads your Reels.");
    expect(yt("no_channel")).toBe("That Google account has no YouTube channel. Connect the account that owns your channel.");
    expect(ig("not_professional")).toBe(
      "That Instagram account isn’t a professional account. Switch it to Creator or Business in Instagram, then connect again.",
    );
    expect(yt("something_new")).toBe("We couldn’t connect YouTube. Try again.");
  });

  test("keeps the page's other parameters; nothing to read without a result", () => {
    expect(readConnectResult("?item=g1&connecting=youtube&connect=failed")?.rest).toBe("?item=g1");
    expect(readConnectResult("?item=g1")).toBeNull();
    expect(readConnectResult("?connecting=youtube")).toBeNull();
    expect(readConnectResult("?connecting=tiktok&connect=failed")).toBeNull();
  });
});
