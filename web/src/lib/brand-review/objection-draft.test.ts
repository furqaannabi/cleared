import { describe, expect, test } from "vitest";
import type { BrandItem } from "./types";
import { canObject, removeObjection, saveObjection } from "./objection-draft";

const item = (id: string, status: BrandItem["status"]): BrandItem => ({ id, name: `Item ${id}`, kind: "said", checkedBy: "ai_timestamp", status });

describe("RW-FR-17, RW-BR-02, RW-BR-03 objections being written", () => {
  test("only a Passed item can be objected to; never one the brand accepted, nor an At live check one", () => {
    expect(canObject(item("a", "passed"))).toBe(true);
    for (const s of ["accepted", "at_live_check", "objected", "asked", "unsure", "fix_needed", "fix_requested"] as const) expect(canObject(item("a", s)), s).toBe(false);
  });

  test("saving needs a note of at most 500 characters, trimmed; saving again edits it in place", () => {
    const items = [item("a", "passed"), item("b", "passed")];
    expect(saveObjection([], items, "a", "   ")).toEqual({ ok: false, problem: "Say what’s wrong with this item." });
    expect(saveObjection([], items, "a", "x".repeat(501))).toEqual({ ok: false, problem: "Keep it to 500 characters." });
    const one = saveObjection([], items, "a", "  Out of focus. ");
    expect(one).toEqual({ ok: true, objections: [{ itemId: "a", note: "Out of focus." }] });
    const two = one.ok ? saveObjection(one.objections, items, "b", "Too quiet.") : one;
    const edited = two.ok ? saveObjection(two.objections, items, "a", "Blurry at 1:10.") : two;
    expect(edited).toEqual({ ok: true, objections: [{ itemId: "a", note: "Blurry at 1:10." }, { itemId: "b", note: "Too quiet." }] });
  });

  test("refuses an item that can't be objected to; removing drops it", () => {
    const items = [item("a", "passed"), item("b", "accepted")];
    expect(saveObjection([], items, "b", "No.")).toEqual({ ok: false, problem: "This item can’t be objected to." });
    expect(removeObjection([{ itemId: "a", note: "x" }, { itemId: "b", note: "y" }], "a")).toEqual([{ itemId: "b", note: "y" }]);
  });
});
