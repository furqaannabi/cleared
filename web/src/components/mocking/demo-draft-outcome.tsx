"use client";

import { Select } from "@/components/ui/select";
import type { DemoOutcome } from "@/mocks/simulate-upload";

/** "usual": DC-FR-45's fixed demo run; otherwise what the demo's next run finds. */
export type DemoChoice = DemoOutcome | "usual";

const OPTIONS: { value: DemoChoice; label: string }[] = [
  { value: "passes", label: "passes every item" },
  { value: "one_unsure", label: "has one Unsure item" },
  { value: "usual", label: "fixes the code (the usual demo run)" },
];

/**
 * Mock builds only: what the next simulated draft finds, so the brand's
 * review can be shown from any post. Never in a real build; nothing is
 * uploaded.
 *
 * @param value - the chosen outcome
 * @param onChange - called with a new choice
 * @see docs/specs/brand-review-frd.md RW-FR-28; docs/specs/creator-draft-check-frd.md DC-FR-45
 */
export function DemoDraftOutcome({ value, onChange }: { value: DemoChoice; onChange: (v: DemoChoice) => void }) {
  return (
    <label className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-latte-line bg-latte-wash px-3 py-2 text-meta text-ink-2">
      <b className="text-ink">Demo</b> (mocks only): the next draft
      <Select value={value} onChange={(e) => onChange(e.target.value as DemoChoice)}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
