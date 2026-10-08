import { describe, expect, test } from "vitest";
import { stepLinks } from "./step-links";

describe("stepLinks (BC-FR-22, BC-FR-23)", () => {
  test("before the brief is sent: posts can change; brief is reached; nothing later", () => {
    expect(stepLinks({ id: "deal_1", step: "checklist", reading: "idle" })).toEqual({
      posts: "/deals/deal_1/posts",
      brief: "/deals/deal_1/checklist#brief",
    });
  });

  test("while reading, the posts are set", () => {
    expect(stepLinks({ id: "deal_1", step: "checklist", reading: "reading" })).toEqual({ brief: "/deals/deal_1/checklist#brief" });
  });

  test("a brief that couldn't be read lets the posts change again", () => {
    expect(stepLinks({ id: "deal_1", step: "checklist", reading: "failed" }).posts).toBe("/deals/deal_1/posts");
  });

  test("once read, the checklist is reached; the invite step once the deal gets there", () => {
    expect(stepLinks({ id: "deal_1", step: "checklist", reading: "done" })).toEqual({
      brief: "/deals/deal_1/checklist#brief",
      checklist: "/deals/deal_1/checklist",
    });
    expect(stepLinks({ id: "deal_1", step: "waiting_for_brand", reading: "done" }).invite).toBe("/deals/deal_1/invite");
  });
});
