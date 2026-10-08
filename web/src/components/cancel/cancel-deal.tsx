"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ApiResult } from "@/lib/api";
import { dealCancelView, type DealCancelPost } from "@/lib/cancel/deal-cancel-view";

const NOTE_MAX = 300;
const QUIET = "inline-flex min-h-11 items-center justify-self-start px-0.5 text-[14px] font-bold text-espresso underline decoration-latte-line underline-offset-3";
const KEEP = "inline-flex min-h-11 items-center justify-center rounded-pill border border-latte-line bg-surface px-4 text-[14.5px] font-bold text-espresso";
const DANGER =
  "inline-flex min-h-11 items-center justify-center rounded-pill bg-fail px-[18px] text-[14.5px] font-bold text-white shadow-[0_2px_6px_rgb(120_20_15/0.22)] disabled:opacity-60";

/**
 * "Cancel the deal" (or, with one post, "Cancel this post" on its line):
 * a quiet button that opens design B's confirmation, a card per post saying
 * what happens to it, an optional note and the two actions; a full-screen
 * sheet on phones. Sends one cancel per post that can go, one at a time, and
 * shows the page as the last answer left it (CN-BR-02, CN-BR-03).
 *
 * @param posts - the posts to offer
 * @param single - one post from its line, worded for a post
 * @param side - whose page this is
 * @param brandName - the brand
 * @param creatorName - the creator
 * @param sendOne - cancels one post with the note; answers with the page's data
 * @param onUpdated - takes the page's data after the cancels
 * @see docs/specs/cancel-frd.md CN-FR-01, CN-FR-02, CN-FR-04, CN-FR-06 to CN-FR-09; design/cancel/option-b.html
 */
export function CancelDeal<T>({
  posts,
  single = false,
  side,
  brandName,
  creatorName,
  sendOne,
  onUpdated,
}: {
  posts: DealCancelPost[];
  single?: boolean;
  side: "creator" | "brand";
  brandName: string;
  creatorName: string;
  sendOne: (deliverableId: string, note?: string) => Promise<ApiResult<T>>;
  onUpdated: (data: T) => void;
}) {
  const view = dealCancelView(posts, { side, brandName, creatorName });
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState("");
  const [note, setNote] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const kept = useRef(false);
  const id = useId();

  useEffect(() => {
    if (open) heading.current?.focus();
    else if (kept.current) {
      kept.current = false;
      button.current?.focus();
    }
  }, [open]);

  const run = async () => {
    setSending(true);
    setFailed(false);
    let last: T | null = null;
    let refused = 0;
    for (const deliverableId of view.going) {
      const r = await sendOne(deliverableId, note.trim() || undefined);
      if (r.ok) last = r.data;
      else if (r.error === "rejected") refused += 1;
      else {
        // CN-FR-08: a request that didn't get through keeps the card open; nothing is retried on its own.
        if (last) onUpdated(last);
        setFailed(true);
        setSending(false);
        return;
      }
    }
    if (last) onUpdated(last);
    // CN-FR-09: a post that changed in the meantime stays, and says so.
    setSaid(refused ? `Not cancelled: ${refused === 1 ? "1 post" : `${refused} posts`} changed in the meantime.` : "Cancelled.");
    setSending(false);
    setOpen(false);
  };

  if (!view.button) return <p aria-live="polite" className="sr-only">{said}</p>;
  return (
    <div className="grid gap-1.5">
      {!open && (
        <button ref={button} type="button" onClick={() => setOpen(true)} className={QUIET}>
          {single ? "Cancel this post" : view.button}
        </button>
      )}
      {open && (
        <section
          aria-labelledby={`${id}-h`}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              kept.current = true;
              setOpen(false);
            }
          }}
          className="fixed inset-0 z-30 grid content-start gap-3 overflow-auto bg-surface p-4 md:relative md:inset-auto md:z-auto md:rounded-lg md:border md:border-line md:p-[18px]"
        >
          <h2 id={`${id}-h`} ref={heading} tabIndex={-1} className="font-head text-[20px] leading-tight font-bold focus:outline-none">
            {single ? "Cancel this post?" : "Cancel the deal?"}
          </h2>
          <ul className="grid gap-2.5">
            {view.cards.map((c) => (
              <li
                key={c.deliverableId}
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5 rounded-md border px-3.5 py-3 ${c.stays ? "border-line bg-surface" : "border-latte-line bg-latte"}`}
              >
                <b className="text-[15px]">{c.name}</b>
                <span className={`font-head text-[18px] font-extrabold tabular-nums ${c.stays ? "text-ink-3" : "text-ink-2"}`}>{c.amount}</span>
                <span className="col-span-2 text-[13.5px] text-ink-3">{c.line}</span>
              </li>
            ))}
          </ul>
          <p className="text-[14.5px] font-bold">This can’t be undone.</p>
          <div>
            <label htmlFor={`${id}-n`} className="mb-1.5 block text-[13.5px] font-bold text-ink-2">
              {view.noteLabel}
            </label>
            <textarea
              id={`${id}-n`}
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="block w-full resize-none rounded-sm border border-latte-line bg-surface px-3 py-2.5 text-[16px] focus-visible:border-espresso"
            />
            <p className="mt-1 text-right text-[12.5px] text-ink-3 tabular-nums">
              {note.length} / {NOTE_MAX}
            </p>
          </div>
          {failed && <p className="text-[14px] font-bold text-fail">That didn’t go through. Try again.</p>}
          <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center">
            <button type="button" disabled={sending} onClick={() => void run()} className={DANGER}>
              {sending ? "Cancelling…" : single ? "Cancel the post" : view.confirm}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                kept.current = true;
                setOpen(false);
              }}
              className={KEEP}
            >
              Keep it
            </button>
          </div>
        </section>
      )}
      <p aria-live="polite" className="sr-only">
        {said}
      </p>
    </div>
  );
}
