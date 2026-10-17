import { render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { PageAnalytics } from "./page-analytics";

const { seen } = vi.hoisted(() => ({ seen: [] as unknown[] }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: (props: unknown) => (seen.push(props), null) }));

describe("LG-FR-17 (1.4) page counts carry no secrets", () => {
  test("every page view is cleaned before Vercel sends it", () => {
    render(<PageAnalytics />);
    const { beforeSend } = seen.at(-1) as { beforeSend: (e: { type: "pageview"; url: string }) => unknown };
    expect(beforeSend({ type: "pageview", url: "https://sponing.com/b/tok_secret?x=1" })).toEqual({ type: "pageview", url: "https://sponing.com/b/[token]" });
  });
});
