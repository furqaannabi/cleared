import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import type { Deliverable } from "@/lib/deliverable/types";
import { server } from "@/mocks/node";
import { CopyReviewLink } from "@/components/draft-check/review-status";
import { SessionProvider } from "@/components/session/use-session";
import { aCreatorPost, aProfile, apiError, stubSession } from "@/test/stub-api";
import { JourneySlot } from "./journey-slot";

/* PP 1.3: the creator's journey against the contract's answers, one stub per test. */

const goAhead = `${apiBaseUrl}/deliverables/del_glow_video/go-ahead`;
const panel = () => screen.getByRole("region", { name: "From approved to paid" });
const show = (d = aCreatorPost() as Deliverable, onUpdated = vi.fn()) => render(<JourneySlot d={d} onUpdated={onUpdated} timeZone="UTC" />);

describe("PP-FR-01 (1.3) the go-ahead takes the unlisted video's link", () => {
  test("the link is sent with the ask", async () => {
    const sent: unknown[] = [];
    server.use(
      http.post(goAhead, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json(aCreatorPost({ state: "posting", goAhead: { state: "go", endsAt: "2099-01-01T00:00:00.000Z" } }));
      }),
    );
    const onUpdated = vi.fn();
    show(undefined, onUpdated);
    const field = within(panel()).getByRole("textbox", { name: "Your unlisted video’s link" });
    expect(field).toHaveAccessibleDescription("Upload the approved draft to your channel as unlisted, then paste its link.");
    await userEvent.type(field, "https://youtu.be/abc123");
    await userEvent.click(within(panel()).getByRole("button", { name: "Get the go-ahead" }));
    expect(sent).toEqual([{ videoUrl: "https://youtu.be/abc123" }]);
    expect(onUpdated).toHaveBeenCalled();
  });

  test("PP-FR-37: a refusal says what's wrong under the field, and the link stays", async () => {
    server.use(http.post(goAhead, () => apiError({ code: "not_the_approved_file" }, 409)));
    show();
    const field = within(panel()).getByRole("textbox", { name: "Your unlisted video’s link" });
    await userEvent.type(field, "https://youtu.be/abc123");
    await userEvent.click(within(panel()).getByRole("button", { name: "Get the go-ahead" }));
    expect(await within(panel()).findByText("That video isn’t the draft Glow Theory approved. Upload the approved file as it was, without re-editing it.")).toBeVisible();
    expect(field).toHaveValue("https://youtu.be/abc123");
  });
});

describe("PP-FR-38 (1.3) the live check can't run yet", () => {
  const published = { state: "published" as const, post: { url: "https://www.youtube.com/watch?v=abc123", publishedAt: "2026-10-11T10:00:00.000Z" } };

  test("reconnecting YouTube is a link to connect it again, coming back here; never a payout button", () => {
    show(aCreatorPost({ ...published, liveCheck: { state: "reconnect_youtube" } }) as Deliverable);
    const links = screen.getAllByRole("link", { name: "Reconnect YouTube" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.getAttribute("href")).toContain("/connect/youtube");
    expect(screen.queryByRole("button", { name: /send it again/i })).toBeNull();
  });

  test("the go-ahead's phone bar doesn't send without the link", () => {
    show();
    expect(screen.getAllByRole("button", { name: "Get the go-ahead" })).toHaveLength(1);
  });
});

describe("PP-FR-01, PP-FR-12 (1.3) asking the API again while it works", () => {
  test.each([
    ["the go-ahead is being confirmed", { goAhead: { state: "confirming" as const } }],
    ["the payment is being collected", { state: "published" as const, liveCheck: { state: "approved" as const, by: "brand_confirmed" as const } }],
    ["a check again is running", { state: "published" as const, liveCheck: { state: "fixable" as const, fixBy: "2099-01-01T00:00:00.000Z", checking: true as const } }],
  ])("%s", async (_, fields) => {
    const answered = aCreatorPost({ state: "posting", goAhead: { state: "go", endsAt: "2099-01-01T00:00:00.000Z" } });
    server.use(http.get(`${apiBaseUrl}/deliverables/del_glow_video`, () => HttpResponse.json(answered)));
    const onUpdated = vi.fn();
    show(aCreatorPost(fields) as Deliverable, onUpdated);
    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalled(), { timeout: 4000 });
  });
});

describe("PP-FR-38 (1.3) names the creator's channel when the profile has it", () => {
  test("a video not found names the connected channel", async () => {
    stubSession(aProfile({ accounts: [{ platform: "youtube", name: "Ada Makes" }] }));
    render(
      <SessionProvider>
        <JourneySlot d={aCreatorPost({ state: "published", liveCheck: { state: "video_not_found" } }) as Deliverable} onUpdated={vi.fn()} timeZone="UTC" />
      </SessionProvider>,
    );
    expect(await screen.findByText("Make sure it’s still on Ada Makes and public, then tap I’ve posted it again. Your deadline still runs.")).toBeVisible();
  });
});

describe("PP-FR-40 (1.3) the brand's link for a live post", () => {
  const link = { url: "https://app.cleared.test/b/tok", expiresAt: "2099-01-01T00:00:00.000Z", expired: false };
  test.each([
    ["confirm", { state: "undecided" as const, what: ["paid_promotion" as const], brandBy: "2026-10-13T14:00:00.000Z" }],
    ["accept", { state: "not_fixable" as const, reason: "not_the_approved_file" as const, brandBy: "2026-10-13T14:00:00.000Z" }],
  ])("when the brand has to %s, the line says why the link is back", (verb, liveCheck) => {
    render(<CopyReviewLink deliverable={aCreatorPost({ state: "published", liveCheck, reviewLink: link }) as Deliverable} onUpdated={vi.fn()} timeZone="UTC" />);
    expect(screen.getByText(`Glow Theory has to ${verb} your live post by Tue 13 Oct, 14:00. We don’t have their email, so send them this link.`)).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy link for Glow Theory" })).toBeVisible();
  });

  test("during a draft review nothing changes", () => {
    render(<CopyReviewLink deliverable={aCreatorPost({ state: "fully_passing", reviewLink: link }) as Deliverable} onUpdated={vi.fn()} />);
    expect(screen.queryByText(/your live post/)).toBeNull();
  });
});
