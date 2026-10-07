import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { setReadingSpeed } from "@/mocks/deal-drafts";
import { ChecklistPage } from "@/components/checklist-builder/checklist-page";

const BRIEF = "Thanks for partnering with Glow Theory!\nSay and show the code GLOW20.\nMention us early in the Reel.";

async function newDeal() {
  const r = await api.createDeal({ brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] });
  if (!r.ok) throw new Error(r.error);
  return r.data.id;
}

describe("BC-FR-04 to BC-FR-08 the brief", () => {
  test("pasting the brief starts the reading, line by line", async () => {
    setReadingSpeed(60_000);
    const id = await newDeal();
    render(<ChecklistPage dealId={id} />);
    await userEvent.type(await screen.findByLabelText("Paste the brief Glow Theory sent"), BRIEF.replaceAll("\n", "{Enter}"));
    await userEvent.click(screen.getByRole("button", { name: "Make the checklist" }));
    const reading = await screen.findByRole("region", { name: "Reading your brief" });
    expect(reading).toHaveTextContent("Say and show the code GLOW20.");
    expect(reading).toHaveTextContent("Mention us early in the Reel.");
  });

  test("BC-FR-05: too short or too long is said before sending", async () => {
    const id = await newDeal();
    render(<ChecklistPage dealId={id} />);
    const box = await screen.findByLabelText("Paste the brief Glow Theory sent");
    await userEvent.type(box, "make a video");
    await userEvent.click(screen.getByRole("button", { name: "Make the checklist" }));
    expect(screen.getByText("This looks too short to be a brief. Paste the whole thing.")).toBeVisible();
    await userEvent.clear(box);
    await userEvent.click(box);
    await userEvent.paste("x".repeat(20_001));
    await userEvent.click(screen.getByRole("button", { name: "Make the checklist" }));
    expect(screen.getByText("Briefs can be up to 20,000 characters, about 8 pages.")).toBeVisible();
  });

  test("BC-FR-07: once read, the checklist shows", async () => {
    setReadingSpeed(0);
    const id = await newDeal();
    await api.submitBrief(id, BRIEF);
    render(<ChecklistPage dealId={id} />);
    expect(await screen.findByRole("heading", { name: "The brief" })).toBeVisible();
    expect(screen.getByRole("tab", { name: /YouTube video/ })).toBeVisible();
  });
});
