import { describe, expect, test } from "vitest";
import { safeNext, signInPath } from "./sign-in-path";

describe("SI-FR-06, SI-BR-02 back where they were going, and only on this site", () => {
  test("a path on this site is kept", () => {
    expect(safeNext("/deals/deal_juniper/deliverables/del_juniper_short?item=js_1")).toBe("/deals/deal_juniper/deliverables/del_juniper_short?item=js_1");
  });
  test("anything else is dropped", () => {
    for (const bad of ["//evil.example/x", "https://evil.example", "javascript:alert(1)", "/\\evil.example", "deals", "", null, undefined]) expect(safeNext(bad)).toBeNull();
  });
  test("the sign-in page carries the path", () => {
    expect(signInPath("/deals/new")).toBe("/sign-in?next=%2Fdeals%2Fnew");
    expect(signInPath("//evil.example")).toBe("/sign-in");
  });
});
