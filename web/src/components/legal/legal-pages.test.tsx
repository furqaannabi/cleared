import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { DataDeletionPage } from "./data-deletion-page";
import { PrivacyPage } from "./privacy-page";
import { TermsPage } from "./terms-page";

describe("LG-FR-01, LG-FR-02, LG-FR-04, LG-FR-16 the reading layout", () => {
  test.each([
    ["Privacy policy", PrivacyPage],
    ["Terms", TermsPage],
    ["Deleting your data", DataDeletionPage],
  ] as const)("%s: title, last updated, the project line, sections listed and linked, contact", (title, Page) => {
    render(<Page />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(title);
    expect(screen.getByText(/^Last updated /)).toBeInTheDocument();
    expect(screen.getByText("Written for the Cleared hackathon project. Not reviewed by a lawyer.")).toBeInTheDocument();
    const toc = screen.getByRole("navigation", { name: "On this page" });
    const sections = screen.getAllByRole("heading", { level: 2 });
    expect(sections.length).toBeGreaterThan(1);
    for (const h of sections) {
      expect(within(toc).getByRole("link", { name: h.textContent! })).toHaveAttribute("href", `#${h.id}`);
    }
    expect(screen.getByRole("link", { name: "williamikeji@gmail.com" })).toHaveAttribute("href", "mailto:williamikeji@gmail.com");
  });
});

describe("LG-FR-05 to LG-FR-10 the privacy policy", () => {
  test("says what is collected, who handles it, and that periods are not yet confirmed while Furqaan's answers are outstanding", () => {
    render(<PrivacyPage />);
    const who = screen.getByRole("region", { name: "Who else handles it" });
    for (const name of ["PayPal", "Amazon Web Services", "Amazon Bedrock", "Google", "Meta", "Resend", "Vercel"]) expect(who).toHaveTextContent(name);
    const collect = screen.getByRole("region", { name: "What we collect, and why" });
    for (const thing of ["name and email from Google", "Read-only access to your YouTube channel", "drafts you upload", "brief you paste", "PayPal email", "The email you choose to give"]) {
      expect(collect).toHaveTextContent(thing);
    }
    expect(screen.getByRole("region", { name: "What we never do" })).toHaveTextContent("Let an AI move money.");
    expect(screen.getByRole("region", { name: "How long we keep it" })).toHaveTextContent("Server logs: not yet confirmed.");
    expect(screen.getByRole("region", { name: "Cookies" })).toHaveTextContent("no tracking or advertising cookies");
  });
});

describe("LG-FR-11, LG-FR-12 the terms", () => {
  test("not a marketplace, sandbox only, the money rules and the AI rule", () => {
    render(<TermsPage />);
    expect(screen.getByText(/It is not a marketplace/)).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "What Cleared is" })).getByText(/No real money moves/)).toBeInTheDocument();
    const money = screen.getByRole("region", { name: "How the money works" });
    for (const rule of ["$20 to $10,000", "48 hours from a fully passing draft", "re-confirms the hold", "passes its live check", "gives the hold back to the brand", "day 28", "5% of the deliverable’s amount"]) {
      expect(money).toHaveTextContent(rule);
    }
    expect(screen.getByRole("region", { name: "The AI, and its limits" })).toHaveTextContent("The AI never moves money.");
  });
});

describe("LG-FR-13 deleting your data", () => {
  test("with Delete account off, deleting is by email only", () => {
    render(<DataDeletionPage removal={false} />);
    const how = screen.getByRole("region", { name: "How to delete your account" });
    expect(how).toHaveTextContent("Email williamikeji@gmail.com from the Google email you signed in with");
    expect(how).not.toHaveTextContent("Settings");
    expect(screen.getByRole("region", { name: "What is deleted, and what is kept" })).toHaveTextContent("with your name and email removed");
  });

  test("with it on, Settings comes first, then email", () => {
    render(<DataDeletionPage removal />);
    const how = screen.getByRole("region", { name: "How to delete your account" });
    expect(how).toHaveTextContent("open Settings and choose Delete account");
    expect(how).toHaveTextContent("Or by email");
  });
});
