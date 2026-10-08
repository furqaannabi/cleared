import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { api, apiBaseUrl } from "@/lib/api";
import { setReadingSpeed } from "@/mocks/deal-drafts";
import { server } from "@/mocks/node";
import { ChecklistPage } from "./checklist-page";

const BRIEF = [
  "Thanks for partnering with Glow Theory on the Dew Drop serum launch!",
  "In the YouTube video, say “Glow Theory” in the first 60 seconds.",
  "Mention us early in the Reel.",
  "Say and show the code GLOW20.",
  "Keep it fun and authentic!",
  "Mark the post as a paid promotion.",
].join("\n");

async function openChecklist() {
  setReadingSpeed(0);
  const r = await api.createDeal({ brandName: "Glow Theory", deliverables: [{ platform: "youtube_video" }, { platform: "instagram_reel" }] });
  if (!r.ok) throw new Error(r.error);
  await api.submitBrief(r.data.id, BRIEF);
  render(<ChecklistPage dealId={r.data.id} />);
  await screen.findByRole("heading", { name: "The brief" });
  return r.data.id;
}
const questions = () => screen.getByRole("region", { name: /questions? to answer/ });
const items = () => screen.getByRole("list", { name: "Checklist items" });
const brief = () => screen.getByRole("region", { name: "The brief" });

describe("BC-FR-09 to BC-FR-12 the checklist", () => {
  test("the brief beside the checklist: every line says what became of it; a tab per post", async () => {
    await openChecklist();
    const lines = within(brief()).getAllByRole("listitem");
    expect(lines.map((l) => l.textContent)).toEqual([
      expect.stringContaining("Not checked"),
      expect.stringContaining("1 item"),
      expect.stringContaining("Question"),
      expect.stringContaining("2 items"),
      expect.stringContaining("Question"),
      expect.stringContaining("1 item"),
    ]);
    expect(screen.getByRole("tab", { name: "YouTube video 4" })).toHaveAttribute("aria-selected", "true");
    expect(within(items()).getByText("Says the code GLOW20")).toBeVisible();
    expect(within(items()).getAllByText("Said · Exact match · Line 4").length).toBe(1);
    await userEvent.click(screen.getByRole("tab", { name: "Instagram Reel 3" }));
    expect(within(items()).queryByText(/first 60 seconds/)).toBeNull();
  });

  test("BC-FR-12: selecting an item marks its brief line", async () => {
    await openChecklist();
    await userEvent.click(within(items()).getByRole("button", { name: "Says the code GLOW20" }));
    const line4 = within(brief()).getAllByRole("listitem")[3];
    expect(line4).toHaveAttribute("aria-current", "true");
  });
});

describe("BC-FR-13 questions", () => {
  test("a suggested answer turns the line into an item on its post", async () => {
    await openChecklist();
    expect(screen.getByRole("heading", { name: "2 questions to answer" })).toBeVisible();
    await userEvent.click(within(questions()).getByRole("button", { name: "In the first 10 seconds" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "1 question to answer" })).toBeVisible());
    expect(within(brief()).getAllByRole("listitem")[2]).toHaveTextContent("1 item");
    await userEvent.click(screen.getByRole("tab", { name: /Instagram Reel/ }));
    expect(within(items()).getByText("Mentions Glow Theory in the first 10 seconds")).toBeVisible();
  });

  test("own words, and leaving a line out", async () => {
    await openChecklist();
    await userEvent.click(within(questions()).getAllByRole("button", { name: "Something else" })[0]);
    await userEvent.type(within(questions()).getByLabelText("Your answer"), "Says Glow Theory before the first cut");
    await userEvent.click(within(questions()).getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "1 question to answer" })).toBeVisible());
    await userEvent.click(within(questions()).getByRole("button", { name: "Leave it out" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /questions? to answer/ })).toBeNull());
    expect(within(brief()).getAllByRole("listitem")[4]).toHaveTextContent("Not checked");
  });
});

describe("BC-FR-14, BC-FR-15 changing items", () => {
  test("edit wording, copy, move and remove from an item's menu", async () => {
    await openChecklist();
    await userEvent.click(within(items()).getByRole("button", { name: "Change “Says the code GLOW20”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit wording" }));
    const box = within(items()).getByLabelText("Wording");
    await userEvent.clear(box);
    await userEvent.type(box, "Says the code GLOW20 clearly");
    await userEvent.click(within(items()).getByRole("button", { name: "Save" }));
    expect(await within(items()).findByText("Says the code GLOW20 clearly")).toBeVisible();

    await userEvent.click(within(items()).getByRole("button", { name: "Change “Says “Glow Theory” in the first 60 seconds”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy to Instagram Reel" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Instagram Reel 4" })).toBeVisible());

    await userEvent.click(within(items()).getByRole("button", { name: "Change “Marked as a paid promotion”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "YouTube video 3" })).toBeVisible());
  });

  test("add an item the brief doesn't mention, marked as added by you", async () => {
    await openChecklist();
    await userEvent.click(screen.getByRole("button", { name: "Add an item" }));
    await userEvent.type(screen.getByLabelText("What should the post do?"), "Shows the serum’s packaging");
    await userEvent.selectOptions(screen.getByLabelText("Kind"), "shown");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    const added = await within(items()).findByText("Shows the serum’s packaging");
    expect(added.closest("li")).toHaveTextContent("Added by you, not in the brief");
  });

  test("BC-FR-18: a failed save says so beside the item, and isn't shown as saved", async () => {
    await openChecklist();
    server.use(http.delete(`${apiBaseUrl}/deals/:dealId/items/:itemId`, () => HttpResponse.json({}, { status: 500 })));
    await userEvent.click(within(items()).getByRole("button", { name: "Change “Says the code GLOW20”" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(await within(items()).findByText("We couldn’t save that. Try again.")).toBeVisible();
    expect(within(items()).getByText("Says the code GLOW20")).toBeVisible();
  });
});

describe("BC-FR-16, BC-FR-17 checklist ready", () => {
  test("waits for every question, then saves and says what's next", async () => {
    await openChecklist();
    const ready = screen.getByRole("button", { name: "Checklist ready" });
    expect(ready).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Answer 2 questions first.")).toBeVisible();
    await userEvent.click(ready);
    expect(screen.getByRole("heading", { name: "2 questions to answer" })).toBeVisible();

    for (let i = 0; i < 2; i++) {
      await userEvent.click(within(questions()).getAllByRole("button", { name: "Leave it out" })[0]);
      await waitFor(() => expect(screen.queryAllByRole("button", { name: "Leave it out" }).length).toBe(1 - i));
    }
    await userEvent.click(screen.getByRole("button", { name: "Checklist ready" }));
    expect(
      await screen.findByText("Your checklist is ready. Next you’ll set the amount and deadline for each post and invite Glow Theory."),
    ).toBeVisible();
    expect(within(items()).queryByRole("button", { name: /^Change/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add an item" })).toBeNull();
    // IN-FR-01: straight on to the invite step.
    expect(screen.getByRole("link", { name: "Set amounts and invite Glow Theory" })).toHaveAttribute("href", expect.stringMatching(/^\/deals\/[^/]+\/invite$/));
  });
});
