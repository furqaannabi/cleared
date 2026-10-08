"use client";

import { useState } from "react";
import { Seal } from "@/components/ui/seal";
import { formatAmount } from "@/lib/invite/amount";
import type { BrandTermsView } from "@/lib/brand-deal/terms-view";
import { AskForChange } from "./ask-for-change";
import { noteKey, useNotes } from "./notes";
import { PlatformMark } from "./platform-mark";

/**
 * One post on the brand's terms sheet: the post, its deadline in days after
 * the hold and its amount, then its checklist. Each item quotes the brief
 * line it came from, or says the creator added it, and says how the creator
 * read a line they settled. On phones the checklist folds, but items with a
 * reading, a change or a note stay in view.
 *
 * @param post - the post, from the terms view
 * @param creator - the creator's name
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-05 to CH-FR-08
 */
export function BrandPostLine({ post, creator, cancel }: { post: BrandTermsView["posts"][number]; creator: string; cancel?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const notes = useNotes();
  // CH-FR-06: folded on phones, but what the brand should look at stays in view.
  const inView = (item: (typeof post.items)[number]) => {
    const key = noteKey({ kind: "item", itemId: item.id });
    return open || !!item.reading || item.changed || notes.editing === key || notes.drafts.some((n) => n.key === key);
  };
  const count = `${post.items.length} ${post.items.length === 1 ? "item" : "items"}`;
  return (
    <section role="group" aria-label={post.label} className="border-t border-line pt-[18px] pb-1.5 first:border-t-0">
      <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3">
        <PlatformMark platform={post.platform} />
        <p>
          <b className="block text-[16px]">{post.label}</b>
          <span className="text-[13.5px] text-ink-3">
            {post.hold.state === "held" && post.hold.deadline
              ? `${creator} posts by ${new Date(`${post.hold.deadline}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`
              : `Within ${post.deadlineDays} days of your hold`}{" "}
            · {count}
          </span>
          {post.changed.length > 0 && (
            <span className="block text-[13px] font-bold text-ink-2">
              {post.changed.map((c, i) => (i === 0 ? `${c[0].toUpperCase()}${c.slice(1)}` : c)).join(" and ")} changed
            </span>
          )}
        </p>
        <b className="text-[17px] font-extrabold">{formatAmount(post.amount)}</b>
      </div>
      <div className="flex flex-wrap gap-x-5 md:ml-[46px]">
        {(["amount", "deadline"] as const).map((kind) => (
          <AskForChange
            key={kind}
            about={{ kind, deliverableId: post.deliverableId }}
            target={`the ${kind} for the ${post.label}`}
            label={`Ask about the ${kind}`}
            name={`Ask about the ${kind} for the ${post.label}`}
          />
        ))}
      </div>
      {/* CN-FR-01: the post's cancel, or how it was cancelled. */}
      {cancel && <div className="md:ml-[46px]">{cancel}</div>}
      <ul className="mt-2.5 md:ml-[46px]">
        {post.items.map((item) => (
          <li
            key={item.id}
            aria-label={item.name}
            className={`${inView(item) ? "grid" : "hidden md:grid"} grid-cols-[20px_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-line-soft py-[13px] first:border-t-0`}
          >
            <Seal fillClassName="fill-line-soft" className="mt-0.5 size-5">
              {null}
            </Seal>
            <b className="text-[15px] font-bold">
              {item.name}
              {item.changed && <span className="ml-2 text-[12.5px] font-bold text-ink-3">Changed</span>}
            </b>
            <p className="col-start-2 text-meta text-ink-3">
              {item.source.kind === "brief" ? (
                <>
                  From your brief: <span className="text-ink-2">“{item.source.line}”</span>
                </>
              ) : (
                `Added by ${creator}`
              )}
            </p>
            {item.reading && (
              <p className="col-start-2 mt-1 rounded-sm border border-latte-line bg-latte-wash px-3 py-[9px] text-[13.5px] text-ink-2">
                You wrote <b className="text-espresso-ink">“{item.reading.line}”</b> {creator} read it as <b className="text-espresso-ink">“{item.reading.answer}”</b>.
              </p>
            )}
            <div className="col-start-2 grid">
              <AskForChange about={{ kind: "item", itemId: item.id }} target={`${item.name} (${post.label})`} />
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center text-[13.5px] font-bold text-espresso underline underline-offset-3 md:hidden"
      >
        {open ? "Hide items" : `View all ${count}`}
      </button>
    </section>
  );
}
