import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { aProfile, stubSession, type Profile } from "@/test/stub-api";
import { SettingsPage } from "./settings-page";

afterEach(() => vi.unstubAllGlobals());

/** The settings page in the creator frame, signed in as this profile. */
async function openSettings(profile: Partial<Profile> = {}) {
  stubSession(aProfile({ name: "Ada Okafor", email: "ada.okafor@gmail.com", paypalEmail: "ada@example.com", accounts: [{ platform: "youtube", name: "Ada Makes", inUse: false }], ...profile }));
  render(
    <AppShell currentDealId={null}>
      <SettingsPage />
    </AppShell>,
  );
  await screen.findByRole("heading", { level: 1, name: "Settings" });
}

describe("ST-FR-01 to ST-FR-03, ST-FR-06, ST-FR-07, ST-FR-10 the page", () => {
  test("the profile band, getting paid and connected accounts; Disconnect and Delete account with no flag (1.3)", async () => {
    await openSettings();
    expect(screen.getByText("Ada Okafor", { selector: "p" })).toBeVisible();
    expect(screen.getByText("Signed in with Google as ada.okafor@gmail.com")).toBeVisible();
    const paid = screen.getByRole("region", { name: "Getting paid" });
    expect(within(paid).getByText("ada@example.com")).toBeVisible();
    const accounts = screen.getByRole("region", { name: "Connected accounts" });
    expect(within(accounts).getByText("Ada Makes")).toBeVisible();
    expect(within(accounts).getByRole("link", { name: "Reconnect YouTube" }).getAttribute("href")).toContain("/connect/youtube");
    expect(within(accounts).getByRole("link", { name: "Connect Instagram" }).getAttribute("href")).toContain("/connect/instagram");
    expect(within(accounts).getByRole("link", { name: "Connect Instagram" }).getAttribute("href")).toContain(encodeURIComponent("/settings"));
    expect(within(accounts).getByRole("button", { name: "Disconnect YouTube" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeVisible();
    expect(screen.getByText("Removes your profile, your connected accounts and everything in your deals.")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Sign out" }).length).toBeGreaterThan(0);
  });
});

describe("ST-FR-04, ST-FR-05 changing the PayPal email", () => {
  test("Change opens the field in place; Save sends it and says which payouts keep the old email", async () => {
    const sent: unknown[] = [];
    await openSettings();
    server.use(
      http.put(`${apiBaseUrl}/me/paypal-email`, async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({
          ...aProfile({ name: "Ada Okafor", paypalEmail: "ada.payments@gmail.com" }),
          postsKeepingEmail: [{ deliverableId: "del_glow_video", dealId: "deal_glow", brandName: "Glow Theory", email: "ada@example.com" }],
        });
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Change your PayPal email" }));
    const field = screen.getByRole("textbox", { name: "Your PayPal email" });
    await userEvent.clear(field);
    await userEvent.type(field, "ada.payments@gmail.com");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved.")).toBeVisible();
    expect(sent).toEqual([{ email: "ada.payments@gmail.com" }]);
    expect(screen.getByText("ada.payments@gmail.com")).toBeVisible();
    expect(screen.getByRole("status", { name: "Payouts keeping the old email" })).toBeVisible();
  });

  test("an email that doesn't look like one is said before sending", async () => {
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Change your PayPal email" }));
    const field = screen.getByRole("textbox", { name: "Your PayPal email" });
    await userEvent.clear(field);
    await userEvent.type(field, "ada@");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Enter an email, like name@example.com")).toBeVisible();
  });
});

describe("ST-FR-07, ST-FR-08 disconnecting", () => {
  const route = `${apiBaseUrl}/connect/youtube`;
  test("confirmed in place, then the row reads not connected", async () => {
    server.use(http.delete(route, () => HttpResponse.json(aProfile({ name: "Ada Okafor", accounts: [] }))));
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect YouTube" }));
    expect(screen.getByText(/Sponing stops reading it\. You can connect it again later\./)).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByRole("link", { name: "Connect YouTube" })).toBeVisible();
  });

  test("refused while a post is under way, naming it", async () => {
    server.use(
      http.delete(route, () =>
        HttpResponse.json({ error: { code: "post_under_way", blocking: [{ dealId: "deal_glow", deliverableId: "del_glow_video", brandName: "Glow Theory", platform: "youtube_video" }] } }, { status: 409 }),
      ),
    );
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect YouTube" }));
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByText("You can’t disconnect YouTube while a post is under way: Glow Theory · YouTube video.")).toBeVisible();
  });
});

describe("ST-FR-08 (1.3) an account in use", () => {
  test("has no Disconnect and says why; Reconnect stays", async () => {
    await openSettings({ accounts: [{ platform: "youtube", name: "Ada Makes", inUse: true }] });
    const accounts = screen.getByRole("region", { name: "Connected accounts" });
    expect(within(accounts).queryByRole("button", { name: "Disconnect YouTube" })).toBeNull();
    expect(within(accounts).getByText("In use by a post under way. You can disconnect it once that post is paid or its hold goes back.")).toBeVisible();
    expect(within(accounts).getByRole("link", { name: "Reconnect YouTube" })).toBeVisible();
  });
});

describe("ST-FR-10, ST-FR-11 deleting the account", () => {
  test("refused while deals are open, listing them", async () => {
    server.use(
      http.delete(`${apiBaseUrl}/me`, () =>
        HttpResponse.json({ error: { code: "deal_open", blocking: [{ dealId: "deal_glow", brandName: "Glow Theory", why: "held" }, { dealId: "deal_juniper", brandName: "Juniper & Salt", why: "payout" }] } }, { status: 409 }),
      ),
    );
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Type delete to confirm" }), "delete");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByText("You can’t delete your account while a deal is open:")).toBeVisible();
    expect(screen.getByText("Glow Theory: a post is held")).toBeVisible();
    expect(screen.getByText("Juniper & Salt: a payout is on its way")).toBeVisible();
  });

  test("only after typing delete; then signed out to the home page", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    server.use(http.delete(`${apiBaseUrl}/me`, () => new HttpResponse(null, { status: 204 })));
    await openSettings();
    await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
    expect(screen.getByText(/Signing in again starts a new, empty account\./).closest("p")).toHaveTextContent(
      "Your profile, your connected accounts, your drafts, and each deal’s brief, checklist and check results are deleted, and brands’ links to your deals stop working. Sponing keeps the payment records it must (amounts, dates and PayPal references), with your name and emails removed. Signing in again starts a new, empty account. This can’t be undone.",
    );
    const go = screen.getByRole("button", { name: "Delete my account" });
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Type delete to confirm" }), "delete");
    await userEvent.click(go);
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("/"));
  });
});
