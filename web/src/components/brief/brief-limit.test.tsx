import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { ChecklistPage } from "@/components/checklist-builder/checklist-page";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { aDealDraft, apiError } from "@/test/stub-api";

const BRIEF = "Thanks for partnering with Glow Theory!\nSay and show the code GLOW20.\nMention us early in the Reel.";
// 3:40 pm today, in the test's own timezone.
const at = new Date();
at.setHours(15, 40, 0, 0);

/** The brief is refused at a limit; the deal itself loads. */
function refusedAt(field: "creator" | "overall", resetsAt?: string) {
  const draft = aDealDraft();
  server.use(
    http.get(`${apiBaseUrl}/deals/${draft.id}`, () => HttpResponse.json(draft)),
    http.post(`${apiBaseUrl}/deals/${draft.id}/brief`, () => apiError({ code: "read_limit", field, resetsAt }, 429)),
  );
  return draft.id;
}

async function send(id: string) {
  render(<ChecklistPage dealId={id} />);
  const box = await screen.findByLabelText("Paste the brief Glow Theory sent");
  await userEvent.click(box);
  await userEvent.paste(BRIEF);
  await userEvent.click(screen.getByRole("button", { name: "Make the checklist" }));
  return box;
}

describe("BC-FR-24 a limit on reading (1.4)", () => {
  test("the creator's own limit says when this brief can be sent, and keeps the text and the button", async () => {
    const box = await send(refusedAt("creator", at.toISOString()));
    expect(await screen.findByRole("alert")).toHaveTextContent("You’ve reached today’s limit on reading briefs. You can send this one from 3:40 pm.");
    expect(box).toHaveValue(BRIEF);
    expect(screen.getByRole("button", { name: "Make the checklist" })).toBeEnabled();
  });

  test("the limit across everyone says Cleared has read all it can today", async () => {
    await send(refusedAt("overall", at.toISOString()));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cleared has read all the briefs it can today. You can send this one from 3:40 pm.");
  });

  test("without a reset time, tomorrow", async () => {
    await send(refusedAt("creator"));
    expect(await screen.findByRole("alert")).toHaveTextContent("You’ve reached today’s limit on reading briefs. You can send this one tomorrow.");
  });
});
