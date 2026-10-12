import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { aReadDraft, stubDealDraft } from "@/test/deal-draft";
import { server } from "@/test/server";
import { aDealDraft, recordRequests, type DealDraft } from "@/test/stub-api";
import { ChecklistPage } from "./checklist-page";

type Item = DealDraft["items"][number];
const added = (d: DealDraft, i: Partial<Item> & Pick<Item, "id" | "deliverableId" | "name">): DealDraft => ({
  ...d,
  items: [...d.items, { kind: "said", addedByCreator: false, checkedBy: "ai_timestamp", ...i }],
});
const answered = (d: DealDraft, id: string, answer: NonNullable<DealDraft["questions"][number]["answer"]>): DealDraft => ({
  ...d,
  questions: d.questions.map((q) => (q.id === id ? { ...q, answer } : q)),
});

/** Glow Theory's read brief on the checklist page; `deal.on` answers a change. */
async function openChecklist() {
  const deal = stubDealDraft(aReadDraft());
  render(<ChecklistPage dealId="deal_glow" />);
  await screen.findByRole("heading", { name: "The brief" });
  return deal;
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
    const deal = await openChecklist();
    const sent = recordRequests();
    deal.on("put", "/questions/:questionId", (d, { body }) =>
      added(answered(d, "q_glow_early", body), { id: "it_glow_early", deliverableId: "del_glow_reel", name: "Mentions Glow Theory in the first 10 seconds", kind: "timing", briefLine: 3 }),
    );
    expect(screen.getByRole("heading", { name: "2 questions to answer" })).toBeVisible();
    await userEvent.click(within(questions()).getByRole("button", { name: "In the first 10 seconds" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "1 question to answer" })).toBeVisible());
    expect(within(brief()).getAllByRole("listitem")[2]).toHaveTextContent("1 item");
    await userEvent.click(screen.getByRole("tab", { name: /Instagram Reel/ }));
    expect(within(items()).getByText("Mentions Glow Theory in the first 10 seconds")).toBeVisible();
    expect(sent).toContainEqual({ method: "PUT", path: "/deals/deal_glow/questions/q_glow_early", body: { kind: "suggestion", text: "In the first 10 seconds" } });
  });

  test("own words, and leaving a line out", async () => {
    const deal = await openChecklist();
    const sent = recordRequests();
    deal.on("put", "/questions/:questionId", (d, { body, params }) => answered(d, params.questionId, body));
    await userEvent.click(within(questions()).getAllByRole("button", { name: "Something else" })[0]);
    await userEvent.type(within(questions()).getByLabelText("Your answer"), "Says Glow Theory before the first cut");
    await userEvent.click(within(questions()).getByRole("button", { name: "Save answer" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "1 question to answer" })).toBeVisible());
    await userEvent.click(within(questions()).getByRole("button", { name: "Leave it out" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /questions? to answer/ })).toBeNull());
    expect(within(brief()).getAllByRole("listitem")[4]).toHaveTextContent("Not checked");
    expect(sent.map((r) => r.body)).toEqual([{ kind: "own_words", text: "Says Glow Theory before the first cut" }, { kind: "left_out" }]);
  });
});

describe("BC-FR-14, BC-FR-15 changing items", () => {
  test("edit wording, copy, move and remove from an item's menu", async () => {
    const deal = await openChecklist();
    deal.on("patch", "/items/:itemId", (d, { body, params }) => ({
      ...d,
      items: d.items.map((i) => (i.id === params.itemId ? { ...i, name: (body as { name: string }).name } : i)),
    }));
    deal.on("post", "/items/:itemId/copy", (d, { body, params }) => {
      const from = d.items.find((i) => i.id === params.itemId)!;
      return added(d, { ...from, id: `${from.id}_copy`, deliverableId: (body as { deliverableId: string }).deliverableId });
    });
    deal.on("delete", "/items/:itemId", (d, { params }) => ({ ...d, items: d.items.filter((i) => i.id !== params.itemId) }));
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
    const deal = await openChecklist();
    const sent = recordRequests();
    deal.on("post", "/items", (d, { body }) => added(d, { ...(body as Pick<Item, "deliverableId" | "name" | "kind">), id: "it_glow_pack", addedByCreator: true }));
    await userEvent.click(screen.getByRole("button", { name: "Add an item" }));
    await userEvent.type(screen.getByLabelText("What should the post do?"), "Shows the serum’s packaging");
    await userEvent.selectOptions(screen.getByLabelText("Kind"), "shown");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    const shown = await within(items()).findByText("Shows the serum’s packaging");
    expect(shown.closest("li")).toHaveTextContent("Added by you, not in the brief");
    expect(sent).toContainEqual({ method: "POST", path: "/deals/deal_glow/items", body: { deliverableId: "del_glow_video", name: "Shows the serum’s packaging", kind: "shown" } });
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
    const deal = await openChecklist();
    deal.on("put", "/questions/:questionId", (d, { body, params }) => answered(d, params.questionId, body));
    deal.on("post", "/checklist/ready", (d) => ({ ...d, step: "invite", ready: true }));
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
    expect(screen.getByRole("link", { name: "Set amounts and invite Glow Theory" })).toHaveAttribute("href", "/deals/deal_glow/invite");
  });
});

describe("BC-FR-22, BC-FR-23 going back from the checklist page", () => {
  test("before the brief is sent, Posts links to the posts page", async () => {
    stubDealDraft(aDealDraft());
    render(<ChecklistPage dealId="deal_new" />);
    const steps = await screen.findByRole("list", { name: "New deal steps" });
    expect(within(steps).getByRole("link", { name: /Posts/ })).toHaveAttribute("href", "/deals/deal_new/posts");
  });

  test("once the brief is read, Posts is set and says so; Brief links to the brief", async () => {
    await openChecklist();
    const steps = screen.getByRole("list", { name: "New deal steps" });
    expect(within(steps).queryByRole("link", { name: /Posts/ })).toBeNull();
    expect(within(steps).getByRole("link", { name: /Brief/ })).toHaveAttribute("href", expect.stringMatching(/\/checklist#brief$/));
    expect(screen.getByText("Posts are set once the brief is read.")).toBeVisible();
    expect(document.getElementById("brief")).not.toBeNull();
  });
});
