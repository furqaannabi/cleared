import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { DealsProvider } from "@/components/shell/use-deals";
import { server } from "@/test/server";
import { aProfile, anInvite, stubDeals, stubInvite, stubSession, type Invite } from "@/test/stub-api";
import { InvitePage } from "./invite-page";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace }) }));

const HELD = { state: "held" as const, reference: "7HK21934LM", deadline: "2026-10-26" };
const agreed = (holds: Invite["posts"][number]["hold"][]): Invite =>
  anInvite({
    step: "agreed",
    posts: holds.map((hold, n) => ({ deliverableId: `del_pine_${n}`, platform: "youtube_video", itemCount: 3, amount: "500.00", deadlineDays: 14, hold })),
  });
const LINK = { url: "https://sponing.example/b/tok_pine", expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(), expired: false };
const waitingForBrand = (): Invite => ({ ...agreed([{ state: "not_started" }, { state: "not_started" }]), step: "waiting_for_brand", link: LINK });
const listed = { id: "deal_pine", brandName: "Pine & Co", status: "Waiting for your draft", openDeliverableId: "del_pine_0", deliverables: [] };

const open = () =>
  render(
    <DealsProvider>
      <InvitePage dealId="deal_pine" />
    </DealsProvider>,
  );

beforeEach(() => {
  replace.mockClear();
  stubSession(aProfile());
  stubDeals([listed]);
});
afterEach(() => vi.useRealTimers());

describe("IN-FR-24 (1.6) while the brand is deciding", () => {
  test("opened with every open post held, the page opens the post the deals list names, replacing itself", async () => {
    stubInvite(agreed([HELD, HELD]));
    open();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/deals/deal_pine/deliverables/del_pine_0"));
  });

  test("a hold made while the page is open: asked again after 5 seconds, then the post opens", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const answers = [agreed([HELD, { state: "not_started" }]), agreed([HELD, HELD])];
    server.use(http.get(`${apiBaseUrl}/deals/deal_pine/invite`, () => HttpResponse.json(answers.length > 1 ? answers.shift() : answers[0])));
    open();
    expect(await screen.findByText("Pine & Co agreed · 1 of 2 held")).toBeVisible();
    expect(replace).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/deals/deal_pine/deliverables/del_pine_0"));
  });

  test("the brand's agreement shows without a reload, and the rail is reloaded when the step changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let listAsked = 0;
    server.use(http.get(`${apiBaseUrl}/deals`, () => (listAsked++, HttpResponse.json([listed]))));
    const answers = [waitingForBrand(), agreed([{ state: "not_started" }, { state: "not_started" }])];
    server.use(http.get(`${apiBaseUrl}/deals/deal_pine/invite`, () => HttpResponse.json(answers.length > 1 ? answers.shift() : answers[0])));
    open();
    await screen.findByRole("region", { name: "Sponsorship terms" });
    const before = listAsked;

    await vi.advanceTimersByTimeAsync(5000);
    expect(await screen.findByText("Pine & Co agreed · 0 of 2 held")).toBeVisible();
    await vi.waitFor(() => expect(listAsked).toBeGreaterThan(before));
    expect(replace).not.toHaveBeenCalled();
  });

  test("nothing is asked while it is the creator's turn", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let asked = 0;
    server.use(http.get(`${apiBaseUrl}/deals/deal_pine/invite`, () => (asked++, HttpResponse.json(anInvite()))));
    open();
    await screen.findByRole("region", { name: "Sponsorship terms" });
    await vi.advanceTimersByTimeAsync(15000);
    expect(asked).toBe(1);
  });

  test("nothing is asked while the tab is hidden", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    let asked = 0;
    server.use(http.get(`${apiBaseUrl}/deals/deal_pine/invite`, () => (asked++, HttpResponse.json(waitingForBrand()))));
    open();
    await screen.findByRole("region", { name: "Sponsorship terms" });
    await vi.advanceTimersByTimeAsync(15000);
    expect(asked).toBe(1);
    hidden.mockRestore();
  });

  test("a failed ask keeps the page as it was, and the next one tries again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const answers: (() => Response)[] = [
      () => HttpResponse.json(agreed([HELD, { state: "not_started" }])),
      () => HttpResponse.error(),
      () => HttpResponse.json(agreed([HELD, HELD])),
    ];
    server.use(http.get(`${apiBaseUrl}/deals/deal_pine/invite`, () => (answers.length > 1 ? answers.shift()! : answers[0]!)()));
    open();
    expect(await screen.findByText("Pine & Co agreed · 1 of 2 held")).toBeVisible();

    await vi.advanceTimersByTimeAsync(5000);
    expect(screen.getByText("Pine & Co agreed · 1 of 2 held")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();

    await vi.advanceTimersByTimeAsync(5000);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/deals/deal_pine/deliverables/del_pine_0"));
  });
});
