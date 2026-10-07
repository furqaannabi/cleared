import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { WhatHappensNext } from "./what-happens-next";

const step = {
  lead: "Every item passed. Northbound Coffee has until Thu 8 Oct, 15:00 to review.",
  detail: "If they say nothing by then, you’re cleared to publish.",
  action: null,
};

describe("DC-FR-47 what happens next (phones)", () => {
  test("shows the next step's lead in bold, then the rest of the explanation, with no button", () => {
    render(<WhatHappensNext step={step} />);
    const block = screen.getByRole("region", { name: "What happens next" });
    expect(block).toHaveTextContent(`${step.lead} ${step.detail}`);
    expect(screen.getByText(step.lead).tagName).toBe("STRONG");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("DC-FR-48: the new run's summary comes first, as one line", () => {
    render(<WhatHappensNext step={step} recap={{ text: "Your fix worked · 1 item still needs you", tone: "pass" }} />);
    const block = screen.getByRole("region", { name: "What happens next" });
    expect(block.textContent?.startsWith("Your fix worked · 1 item still needs you")).toBe(true);
  });

  test("the lead links to the first item that needs the creator", async () => {
    const onShowItem = vi.fn();
    render(<WhatHappensNext step={{ lead: "Fix 1 item, then upload a new draft.", detail: "", action: "upload_new_draft" }} onShowItem={onShowItem} />);
    await userEvent.click(screen.getByRole("button", { name: "Fix 1 item, then upload a new draft." }));
    expect(onShowItem).toHaveBeenCalledOnce();
  });
});
