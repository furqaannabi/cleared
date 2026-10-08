import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { api } from "@/lib/api";
import { signInAs } from "@/mocks/session";
import { WelcomePage } from "./welcome-page";

describe("SI-FR-08 to SI-FR-10 the welcome page (design C)", () => {
  test("the promise as the deal ahead, then the setup, counting what's done", async () => {
    const user = userEvent.setup();
    signInAs("new");
    render(<WelcomePage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Get paid for every brand deal, on time." })).toBeVisible();
    expect(screen.getByText("Welcome, Sam")).toBeVisible();
    const ahead = screen.getByRole("list", { name: "The deal ahead" });
    expect(within(ahead).getAllByRole("listitem").map((li) => li.querySelector("b")?.textContent)).toEqual([
      "The money is held before you start.",
      "No surprises at review.",
      "Paid when your post goes live.",
    ]);
    const setup = screen.getByRole("region", { name: "Set up in a minute" });
    expect(setup).toHaveTextContent("0 of 3 done");
    await user.click(within(setup).getByRole("button", { name: "Connect YouTube" }));
    expect(await within(setup).findByText("Connected as Sam Rivera")).toBeVisible();
    expect(setup).toHaveTextContent("1 of 3 done");
    const email = within(setup).getByRole("textbox", { name: "Your PayPal email" });
    await user.type(email, "sam@example.com");
    await user.tab();
    await waitFor(() => expect(setup).toHaveTextContent("2 of 3 done"));
  });

  test("Start your first deal and Skip for now mark the welcome seen", async () => {
    const user = userEvent.setup();
    signInAs("new");
    render(<WelcomePage />);
    expect(await screen.findByRole("link", { name: "Start your first deal" })).toHaveAttribute("href", "/deals/new");
    const skip = screen.getByRole("link", { name: "Skip for now" });
    expect(skip).toHaveAttribute("href", "/deals");
    await user.click(skip);
    await waitFor(async () => {
      const me = await api.getProfile();
      expect(me.ok && me.data.welcomed).toBe(true);
    });
  });

  test("shown once: an account that has seen it is sent to its deals", async () => {
    render(<WelcomePage />);
    expect(await screen.findByRole("link", { name: "Go to your deals" })).toHaveAttribute("href", "/deals");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
});
