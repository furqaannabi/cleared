import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test, vi } from "vitest";
import { apiBaseUrl } from "@/lib/api";
import { server } from "@/test/server";
import { aProfile, stubSession } from "@/test/stub-api";
import { ErrorMessage } from "./error-message";
import { NotFoundPage } from "./not-found-page";

// next/font only runs in Next's compiler; the global error page's fonts are stood in for here.
vi.mock("next/font/google", () => ({ Bricolage_Grotesque: () => ({ variable: "font-b" }), Figtree: () => ({ variable: "font-f" }) }));

describe("EP-FR-03, EP-FR-04, EP-FR-06 something went wrong", () => {
  test("says so, offers Try again and the email, and gives the reference, never the message", async () => {
    const retry = vi.fn();
    render(<ErrorMessage error={Object.assign(new Error("db password=hunter2 failed"), { digest: "3141592653" })} retry={retry} />);
    const heading = screen.getByRole("heading", { level: 1, name: "Something went wrong on this page" });
    expect(heading).toHaveFocus();
    expect(screen.getByRole("alert")).toContainElement(heading);
    expect(screen.getByText(/Try again\. If it keeps happening, email/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "williamikeji@gmail.com" })).toHaveAttribute("href", "mailto:williamikeji@gmail.com");
    expect(screen.getByText("Reference: 3141592653")).toBeInTheDocument();
    expect(screen.queryByText(/hunter2/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test("with no digest, the reference line is left out", () => {
    render(<ErrorMessage error={new Error("x")} retry={vi.fn()} />);
    expect(screen.queryByText(/Reference/)).toBeNull();
  });
});

describe("EP-FR-01, EP-FR-02 not found", () => {
  test("signed out: the heading, the line, Go to the home page and the brands' line", async () => {
    stubSession(null);
    render(<NotFoundPage />);
    expect(screen.getByRole("heading", { level: 1, name: "We can’t find that page" })).toBeInTheDocument();
    expect(screen.getByText("The address may be mistyped, or the page may have moved.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Opening a deal from a creator’s link? Open the link again, or ask them for a new one.")).toBeInTheDocument();
  });

  test("signed in: Open your deals", async () => {
    stubSession(aProfile());
    render(<NotFoundPage />);
    expect(await screen.findByRole("link", { name: "Open your deals" })).toHaveAttribute("href", "/deals");
    expect(screen.queryByRole("link", { name: "Go to the home page" })).toBeNull();
  });

  test("if /me fails, Go to the home page", async () => {
    server.use(http.get(`${apiBaseUrl}/me`, () => HttpResponse.json({}, { status: 500 })));
    render(<NotFoundPage />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("link", { name: "Go to the home page" })).toBeInTheDocument();
  });
});

describe("EP-FR-05 the whole app fails", () => {
  test("Reload reloads the page", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const { default: GlobalError } = await import("@/app/global-error");
    const html = GlobalError({ error: Object.assign(new Error("x"), { digest: "42" }), retry: vi.fn() });
    expect(html.type).toBe("html");
    const body = html.props.children;
    render(body.props.children[1]);
    expect(screen.getByText("Reference: 42")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(reload).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
