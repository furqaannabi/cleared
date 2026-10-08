import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { LandingPage } from "./landing-page";

const page = () => render(<LandingPage />);

describe("Landing page", () => {
  test("LP-FR-01, LP-FR-02: the logo, the tagline as the only h1, and one sentence", () => {
    page();
    expect(screen.getByRole("link", { name: "Cleared home" })).toHaveAttribute("href", "/");
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent("Brand deals where the content and the payment clear together.");
    expect(
      screen.getByText("The brand’s money is held in PayPal, AI checks your video against the brief, and you’re paid when the approved post is live."),
    ).toBeInTheDocument();
  });

  test("LP-FR-03, LP-FR-04, LP-FR-17 (1.2): the two ways in, in the hero and the closing band, with the notes", () => {
    page();
    const google = screen.getAllByRole("link", { name: "Sign in with Google" });
    expect(google).toHaveLength(2);
    for (const g of google) expect(g.getAttribute("href")).toMatch(/\/auth\/google$/);
    expect(screen.getAllByRole("button", { name: "Try the demo account" })).toHaveLength(2);
    expect(screen.getAllByText("The demo account has made-up data. No real money moves.").length).toBe(2);
    expect(screen.getAllByText("Instagram-only? Sign in with any Google account, then connect your Instagram.").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("link", { name: "See a deal in action" })).toBeNull();
    expect(screen.getByRole("heading", { name: "See a whole deal clear." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  });

  test("LP-FR-05: the product visual is the app on an example deal, labelled as an example", () => {
    page();
    const visual = screen.getByRole("figure", { name: "An example deal with made-up data" });
    expect(within(visual).getAllByText("$1,200.00").length).toBeGreaterThan(0);
    expect(within(visual).getByText("Mentions Glow Theory")).toBeInTheDocument();
    expect(within(visual).getByText("Code GLOW20 on screen")).toBeInTheDocument();
  });

  test("LP-FR-08: the problem, told as the chat creators know", () => {
    page();
    const problem = screen.getByRole("region", { name: "You post. Then you chase payment." });
    expect(problem).toHaveTextContent("It’s processing, should be soon!");
    expect(problem).toHaveTextContent("It’s already live…");
    expect(problem).toHaveTextContent("Day 41");
  });

  test("LP-FR-09: one deal, start to paid, in five steps", () => {
    page();
    const deal = screen.getByRole("list", { name: "How a deal runs" });
    const steps = within(deal).getAllByRole("listitem").filter((li) => li.parentElement === deal);
    expect(steps.map((s) => within(s).getByRole("heading").textContent)).toEqual([
      "Agree the checklist",
      "Money held in PayPal",
      "AI checks your draft",
      "48-hour review",
      "Publish, get paid",
    ]);
    expect(steps[2]).toHaveTextContent("Fix needed");
    expect(steps[3]).toHaveTextContent("Silence clears a fully passing draft.");
    expect(steps[4]).toHaveTextContent("Paid to you");
    expect(within(steps[4]).getByText("CLEARED")).toBeInTheDocument();
  });

  test("LP-FR-10, LP-FR-11: the four promises and the brand's note", () => {
    page();
    const rules = screen.getByRole("region", { name: "Rules that protect you" });
    for (const rule of [
      "The AI never moves money",
      "Unsure goes to a person",
      "A missed deadline returns the hold",
      "Only a full pass clears on a timer",
    ])
      expect(within(rules).getByRole("heading", { name: rule })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "For the brand" })).toHaveTextContent(
      "Your money is held, not paid, until the approved post is live and checked.",
    );
  });

  test("LP-FR-12: the footer names the hackathon, the tools, and links the repository and licence", () => {
    page();
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Built for the PayPal AI Hackathon");
    expect(footer).toHaveTextContent("Claude on Amazon Bedrock");
    expect(footer).toHaveTextContent("AG Grid");
    expect(footer).toHaveTextContent("APIMatic");
    expect(within(footer).getByRole("link", { name: "GitHub repository" })).toHaveAttribute("href", "https://github.com/furqaannabi/cleared");
    expect(within(footer).getByRole("link", { name: "MIT licence" })).toHaveAttribute(
      "href",
      "https://github.com/furqaannabi/cleared/blob/main/LICENSE",
    );
  });

  test("LP-BR-02: never asks for anything: no form fields (the demo account's form is a single button)", () => {
    const { container } = page();
    expect(container.querySelector("input, select, textarea")).toBeNull();
    for (const form of container.querySelectorAll("form")) expect([...form.elements].map((e) => e.tagName)).toEqual(["BUTTON"]);
  });

  test("headings are in order: one h1, then h2s, with h3s only inside sections", () => {
    const { container } = page();
    const levels = [...container.querySelectorAll("h1,h2,h3,h4")].map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
  });
});
