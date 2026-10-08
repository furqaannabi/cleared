import { describe, expect, test } from "vitest";
import { dealCancelView, type DealCancelPost } from "./deal-cancel-view";

const post = (o: Partial<DealCancelPost>): DealCancelPost => ({ deliverableId: "a", platform: "youtube_video", amount: "1500.00", held: true, cancel: { allowed: true }, ...o });
const creator = (posts: DealCancelPost[]) => dealCancelView(posts, { side: "creator", brandName: "Juniper & Salt", creatorName: "Ada Okafor" });

describe("CN-FR-02, CN-FR-06 cancelling the deal (design B)", () => {
  test("one card per post: what goes back, what closes, what stays and why", () => {
    const v = creator([
      post({}),
      post({ deliverableId: "b", platform: "instagram_reel", amount: "600.00", held: false }),
      post({ deliverableId: "c", platform: "youtube_short", amount: "350.00", cancel: { allowed: false, reason: "go_ahead_running" } }),
    ]);
    expect(v.cards).toEqual([
      { deliverableId: "a", name: "YouTube video", amount: "$1,500.00", line: "Goes back to Juniper & Salt", stays: false },
      { deliverableId: "b", name: "Instagram Reel", amount: "$600.00", line: "Closes · nothing is held yet", stays: false },
      { deliverableId: "c", name: "YouTube Short", amount: "$350.00", line: "Stays held · you have the go-ahead to post", stays: true },
    ]);
    expect(v).toMatchObject({ button: "Cancel the deal", confirm: "Cancel 2 posts", noteLabel: "Add a note for Juniper & Salt (optional)" });
  });

  test("every post cancellable reads Cancel the deal; nothing cancellable hides the button; finished posts aren't listed", () => {
    expect(creator([post({}), post({ deliverableId: "b" })]).confirm).toBe("Cancel the deal");
    expect(creator([post({ cancel: { allowed: false, reason: "published" } })]).button).toBeNull();
    expect(creator([post({}), post({ deliverableId: "z", cancel: { allowed: false, reason: "finished" } })]).cards.map((c) => c.deliverableId)).toEqual(["a"]);
  });

  test("the brand: money comes back to it; the note is for the creator", () => {
    const v = dealCancelView([post({}), post({ deliverableId: "c", cancel: { allowed: false, reason: "go_ahead_running" } })], { side: "brand", brandName: "Juniper & Salt", creatorName: "Ada Okafor" });
    expect(v.cards.map((c) => c.line)).toEqual(["Comes back to you", "Stays held · Ada Okafor has the go-ahead to post"]);
    expect(v.noteLabel).toBe("Add a note for Ada Okafor (optional)");
  });

  test("CN-FR-05: a hold waiting at PayPal is stopped there too", () => {
    expect(creator([post({ held: false, cancel: { allowed: true, holdAttemptWaiting: true } })]).cards[0].line).toBe("Closes · we’ll also stop the hold waiting at PayPal");
  });
});
