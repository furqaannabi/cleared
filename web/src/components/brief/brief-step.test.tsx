import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { ChecklistPage } from "@/components/checklist-builder/checklist-page";
import { aReadDraft, stubDealDraft } from "@/test/deal-draft";
import { aDealDraft, recordRequests } from "@/test/stub-api";

const BRIEF = "Thanks for partnering with Glow Theory!\nSay and show the code GLOW20.\nMention us early in the Reel.";

/** A new deal with Glow Theory, a video and a Reel, before its brief. */
const newDeal = () =>
  aDealDraft({ deliverables: [{ id: "del_new_video", platform: "youtube_video" }, { id: "del_new_reel", platform: "instagram_reel" }] });

describe("BC-FR-04 to BC-FR-08 the brief", () => {
  test("pasting the brief starts the reading, line by line", async () => {
    const deal = stubDealDraft(newDeal());
    const sent = recordRequests();
    deal.on("post", "/brief", (d, { body }) => ({
      ...d,
      reading: "reading",
      brief: { lines: (body as { text: string }).text.split("\n").map((text, i) => ({ number: i + 1, text })) },
    }));
    render(<ChecklistPage dealId="deal_new" />);
    await userEvent.type(await screen.findByLabelText("Paste the brief Glow Theory sent"), BRIEF.replaceAll("\n", "{Enter}"));
    await userEvent.click(screen.getByRole("button", { name: "Make the checklist" }));
    const reading = await screen.findByRole("region", { name: "Reading your brief" });
    expect(reading).toHaveTextContent("Say and show the code GLOW20.");
    expect(reading).toHaveTextContent("Mention us early in the Reel.");
    expect(sent).toContainEqual({ method: "POST", path: "/deals/deal_new/brief", body: { text: BRIEF } });
  });

  test("BC-FR-05: too short or too long is said before sending", async () => {
    stubDealDraft(newDeal());
    render(<ChecklistPage dealId="deal_new" />);
    const box = await screen.findByLabelText("Paste the brief Glow Theory sent");
    const sent = recordRequests();
    await userEvent.type(box, "make a video");
    await userEvent.click(screen.getByRole("button", { name: "Make the checklist" }));
    expect(screen.getByText("This looks too short to be a brief. Paste the whole thing.")).toBeVisible();
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste("x".repeat(20_001));
    await userEvent.click(screen.getByRole("button", { name: "Make the checklist" }));
    expect(screen.getByText("Briefs can be up to 20,000 characters, about 8 pages.")).toBeVisible();
    expect(sent.filter((r) => r.method === "POST")).toEqual([]);
  });

  test("BC-FR-07: once read, the checklist shows", async () => {
    stubDealDraft(aReadDraft());
    render(<ChecklistPage dealId="deal_glow" />);
    expect(await screen.findByRole("heading", { name: "The brief" })).toBeVisible();
    expect(screen.getByRole("tab", { name: /YouTube video/ })).toBeVisible();
  });
});
