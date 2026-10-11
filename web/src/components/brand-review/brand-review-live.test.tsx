import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/mocks/node";
import { aBrandPost, apiError, stubBrandPost } from "@/test/stub-api";
import { BrandReviewPage } from "./brand-review-page";

/* RW 1.2: the brand's review against the contract's answers, one stub per test. */

const post = aBrandPost();
const postPath = `${apiBaseUrl}/brand/deals/${post.dealId}/deliverables/${post.deliverableId}`;

describe("RW-FR-04 (1.2) no session", () => {
  test("a 401 asks for the link again, never 'check your connection'", async () => {
    server.use(
      http.get(postPath, () => apiError({ code: "signed_out" }, 401)),
      http.get(`${apiBaseUrl}/brand/deals/${post.dealId}`, () => apiError({ code: "signed_out" }, 401)),
    );
    render(<BrandReviewPage dealId={post.dealId} deliverableId={post.deliverableId} />);
    expect(await screen.findByRole("heading", { name: "Open the link you were sent again" })).toBeVisible();
    expect(screen.queryByText(/connection/i)).toBeNull();
  });
});

describe("RW-FR-31 (1.2) the session ends during an action", () => {
  const ended = "Your access to this deal has ended. Open the link Ada Okafor sent you, then try again here.";

  test("approving says to open the link again, and the confirmation stays to try again", async () => {
    stubBrandPost(post);
    server.use(http.post(`${postPath}/approve`, () => apiError({ code: "signed_out" }, 401)));
    render(<BrandReviewPage dealId={post.dealId} deliverableId={post.deliverableId} />);
    const review = await screen.findByRole("region", { name: "Your review" });
    await userEvent.click(within(review).getByRole("button", { name: "Approve draft" }));
    await userEvent.click(within(review).getByRole("button", { name: "Yes, approve" }));
    expect(await within(review).findByText(ended)).toBeVisible();
    expect(within(review).getByRole("button", { name: "Yes, approve" })).toBeVisible();
    expect(screen.queryByText(/couldn’t reach/i)).toBeNull();
  });

  test("sending objections keeps every unsent note and the confirmation", async () => {
    stubBrandPost(post);
    server.use(http.post(`${postPath}/objections`, () => apiError({ code: "signed_out" }, 401)));
    render(<BrandReviewPage dealId={post.dealId} deliverableId={post.deliverableId} />);
    const review = await screen.findByRole("region", { name: "Your review" });
    await userEvent.click(screen.getByRole("button", { name: "Object to Say the code TIDE15" }));
    await userEvent.type(screen.getByRole("textbox", { name: "What’s wrong with Say the code TIDE15?" }), "Say it slower.");
    await userEvent.click(screen.getByRole("button", { name: "Save objection" }));
    await userEvent.click(within(review).getByRole("button", { name: "Send 1 objection to Ada Okafor" }));
    await userEvent.click(within(review).getByRole("button", { name: "Yes, send" }));
    expect(await within(review).findByText(ended)).toBeVisible();
    expect(within(review).getByText("Say it slower.")).toBeVisible();
    expect(within(review).getByRole("button", { name: "Yes, send" })).toBeVisible();
  });

  test("asking for a fix says so beside the item, and the note being written stays", async () => {
    const asked = aBrandPost({ review: { state: "asked" }, draft: { ...post.draft!, items: [{ ...post.draft!.items[0], status: "asked" }] } });
    stubBrandPost(asked);
    server.use(http.post(`${postPath}/items/it_juniper_code/fix`, () => apiError({ code: "signed_out" }, 401)));
    render(<BrandReviewPage dealId={post.dealId} deliverableId={post.deliverableId} />);
    const checklist = await screen.findByRole("region", { name: "Checklist" });
    const item = within(checklist).getByRole("button", { name: /^Say the code TIDE15/ }).closest("li")!;
    await userEvent.click(within(item).getByRole("button", { name: "Ask Ada Okafor to fix it" }));
    await userEvent.type(within(item).getByRole("textbox", { name: "A note for Ada Okafor (optional)" }), "Louder, please.");
    await userEvent.click(within(item).getByRole("button", { name: "Send to Ada Okafor" }));
    expect(await within(item).findByText(ended)).toBeVisible();
    expect(within(item).getByRole("textbox", { name: "A note for Ada Okafor (optional)" })).toHaveValue("Louder, please.");
    expect(screen.getAllByText(ended)).toHaveLength(1);
  });
});


describe("RW-FR-20 (1.2) the window ended while objections were being written", () => {
  test("a send refused as too late shows the draft approved by the window, with the notes kept to copy", async () => {
    let reads = 0;
    server.use(
      http.get(postPath, () => {
        reads += 1;
        const approved = { state: "approved" as const, approvedAt: new Date().toISOString(), by: "window" as const };
        return HttpResponse.json(reads === 1 ? post : { ...post, review: approved });
      }),
      http.post(`${postPath}/objections`, () => apiError({ code: "window_ended" }, 409)),
    );
    render(<BrandReviewPage dealId={post.dealId} deliverableId={post.deliverableId} />);
    const review = await screen.findByRole("region", { name: "Your review" });
    await userEvent.click(screen.getByRole("button", { name: "Object to Say the code TIDE15" }));
    await userEvent.type(screen.getByRole("textbox", { name: "What’s wrong with Say the code TIDE15?" }), "Say it slower.");
    await userEvent.click(screen.getByRole("button", { name: "Save objection" }));
    await userEvent.click(within(review).getByRole("button", { name: "Send 1 objection to Ada Okafor" }));
    await userEvent.click(within(review).getByRole("button", { name: "Yes, send" }));
    expect(await within(review).findByText(/so this draft is approved\. Your objections weren’t sent\./)).toBeVisible();
    expect(within(review).getByText("Say it slower.")).toBeVisible();
    expect(within(review).queryByRole("button", { name: /^Send/ })).toBeNull();
  });
});
