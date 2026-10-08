"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ReturnIcon } from "@/components/money/money-icons";
import { Seal } from "@/components/ui/seal";
import { cancelView, type CancelInfo } from "@/lib/cancel/cancel-view";
import { useCancelPost, type CancelSend } from "./use-cancel-post";

const NOTE_MAX = 300;
const KEEP = "inline-flex min-h-11 items-center justify-center rounded-pill border border-latte-line px-4 text-[14.5px] font-bold text-espresso";
const DANGER =
  "inline-flex min-h-11 items-center justify-center rounded-pill bg-fail px-[18px] text-[14.5px] font-bold text-white shadow-[0_2px_6px_rgb(120_20_15/0.22)] disabled:opacity-60";

/**
 * A post's money card with "Cancel this post" under it. Tapping it turns the
 * card over (design B): where the money would go, the amount, an optional
 * note and the two actions; a full-screen sheet on phones. Without the
 * button, a line says why the post can't be cancelled now.
 *
 * @param post - the post, as CancelInfo
 * @param side - whose page this is
 * @param creatorName - the creator, as the brand knows them
 * @param send - sends the cancel (the creator's or the brand's call)
 * @param reload - reads the post again after a refused cancel
 * @param onUpdated - takes the post the API returned
 * @param children - the money card as the page shows it
 * @see docs/specs/cancel-frd.md CN-FR-01, CN-FR-03 to CN-FR-10, CN-FR-17, CN-FR-18; design/cancel/option-b.html
 */
export function CancelPost<T extends { cancelled?: unknown }>({
  post,
  side,
  creatorName,
  send,
  reload,
  onUpdated,
  children,
}: {
  post: CancelInfo;
  side: "creator" | "brand";
  creatorName: string;
  send: CancelSend<T>;
  reload: () => Promise<T | null>;
  onUpdated: (d: T) => void;
  children: ReactNode;
}) {
  const view = cancelView(post, { side, creatorName });
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const kept = useRef(false);
  const cancel = useCancelPost({ send, reload, onUpdated, onDone: () => setOpen(false) });
  const close = () => {
    kept.current = true;
    setOpen(false);
  };
  // CN-FR-04: Keep it hands focus back to the button.
  useEffect(() => {
    if (!open && kept.current) {
      kept.current = false;
      button.current?.focus();
    }
  }, [open]);
  return (
    <div className="grid gap-1.5">
      {open ? <TurnedCard view={view} cancel={cancel} onKeep={close} /> : children}
      {!open && view.button && (
        <button
          ref={button}
          type="button"
          onClick={() => {
            cancel.reset();
            setOpen(true);
          }}
          className="inline-flex min-h-11 items-center justify-self-start px-0.5 text-[14px] font-bold text-espresso underline decoration-latte-line underline-offset-3"
        >
          {view.button}
        </button>
      )}
      {!open && !view.button && (cancel.refusal ?? view.why) && <p className="flex min-h-11 items-center text-[13.5px] text-ink-3">{cancel.refusal ?? view.why}</p>}
      {/* A polite live region, not a second status role beside the page's own. */}
      <p aria-live="polite" className="sr-only">
        {cancel.announcement}
      </p>
    </div>
  );
}

function TurnedCard({ view, cancel, onKeep }: { view: ReturnType<typeof cancelView>; cancel: ReturnType<typeof useCancelPost>; onKeep: () => void }) {
  const c = view.confirm;
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [note, setNote] = useState("");
  useEffect(() => heading.current?.focus(), []);
  return (
    <section
      aria-labelledby={`${id}-h`}
      onKeyDown={(e) => e.key === "Escape" && onKeep()}
      className="fixed inset-0 z-30 grid grid-rows-[auto_auto_auto_auto_1fr_auto] gap-3 overflow-auto bg-latte p-4 text-ink md:relative md:inset-auto md:z-auto md:grid-rows-none md:rounded-lg md:border md:border-latte-line md:p-[18px]"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -top-[70px] -right-[60px] size-[200px] rounded-full bg-white/50" />
      <Seal fillClassName="fill-latte-line" className="absolute top-4 right-[18px] size-[46px]">
        <ReturnIcon className="size-full text-espresso" />
      </Seal>
      <h2 id={`${id}-h`} ref={heading} tabIndex={-1} className="relative pr-14 font-head text-[20px] leading-tight font-bold focus:outline-none">
        {c.heading}
      </h2>
      <div className="relative">
        <p className="text-chip font-bold text-ink-3">{c.goes}</p>
        <p className="font-head text-amount-phone font-extrabold tracking-[-0.01em] text-ink-2 tabular-nums">{c.amount}</p>
      </div>
      <p className="relative text-[14.5px] text-ink-2">
        {c.say} <b className="text-ink">{c.final}</b>
      </p>
      <div className="relative self-start rounded-md bg-surface/60 p-3">
        <label htmlFor={`${id}-n`} className="mb-1.5 block text-[13.5px] font-bold text-ink-2">
          {c.noteLabel}
        </label>
        <textarea
          id={`${id}-n`}
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="block w-full resize-none rounded-sm border border-latte-line bg-surface px-3 py-2.5 text-[16px] focus-visible:border-espresso"
        />
        <p aria-live="polite" className="mt-1 text-right text-[12.5px] text-ink-3 tabular-nums">
          {note.length} / {NOTE_MAX}
        </p>
      </div>
      {cancel.failed && <p className="relative text-[14px] font-bold text-fail">That didn’t go through. Try again.</p>}
      <div className="relative flex flex-col-reverse gap-2 self-end md:flex-row md:items-center md:self-auto">
        <button type="button" disabled={cancel.sending} onClick={() => void cancel.run(note)} className={DANGER}>
          {cancel.sending ? "Cancelling…" : c.confirm}
        </button>
        <button type="button" disabled={cancel.sending} onClick={onKeep} className={KEEP}>
          Keep it
        </button>
      </div>
    </section>
  );
}
