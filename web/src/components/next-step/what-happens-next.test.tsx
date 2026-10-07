import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { WhatHappensNext } from "./what-happens-next";

describe("DC-FR-47 what happens next (phones)", () => {
  test("shows the next step's lead in bold, then the rest of the explanation", () => {
    render(
      <WhatHappensNext
        step={{
          lead: "Every item passed. Northbound Coffee has until Thu 8 Oct, 15:00 to review.",
          detail: "If they say nothing by then, you’re cleared to publish.",
          action: null,
        }}
      />,
    );
    const block = screen.getByRole("region", { name: "What happens next" });
    expect(block).toHaveTextContent(
      "Every item passed. Northbound Coffee has until Thu 8 Oct, 15:00 to review. If they say nothing by then, you’re cleared to publish.",
    );
    expect(screen.getByText("Every item passed. Northbound Coffee has until Thu 8 Oct, 15:00 to review.").tagName).toBe("STRONG");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("shows nothing when the next step has no second sentence", () => {
    const { container } = render(<WhatHappensNext step={{ lead: "Upload your draft again.", detail: "", action: "upload_again" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
