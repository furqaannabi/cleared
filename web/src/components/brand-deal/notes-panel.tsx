"use client";

import { noteTarget } from "@/lib/brand-deal/terms-view";
import type { BrandDeal } from "@/lib/brand-deal/types";
import { AskForChange } from "./ask-for-change";
import { useNotes } from "./notes";

/**
 * "Your notes for {creator}". Before sending: the brand's unsent notes, the
 * note about the deal as a whole, and "Send {n} changes to {creator}". Once
 * sent: what happens next and the notes, read-only. On a later version: the
 * earlier notes with the creator's replies.
 *
 * @param deal - the deal as the brand sees it
 * @param sending - whether the notes are being sent
 * @param failed - the last send failed
 * @param onSend - sends the notes
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-10 to CH-FR-13
 */
export function NotesPanel({ deal, sending, failed, onSend }: { deal: BrandDeal; sending: boolean; failed: boolean; onSend: () => void }) {
  const { drafts } = useNotes();
  const creator = deal.creatorName;
  const sent = deal.step === "changes_requested";
  const current = deal.notes.filter((n) => n.version === deal.version);
  const earlier = deal.notes.filter((n) => n.version < deal.version);
  const n = drafts.length;
  if (deal.step === "agreed" && earlier.length === 0) return null;
  return (
    <section aria-labelledby="notes-heading" className="grid gap-3 rounded-[18px] border border-line bg-surface p-[18px]">
      <h2 id="notes-heading" className="font-head text-[17px] font-extrabold">
        Your notes for {creator}
      </h2>
      {sent ? (
        <>
          <p role="status" className="text-[14.5px] text-ink-2">
            Sent to {creator}. When they update the terms, this page shows the new version. You can close it.
          </p>
          <NoteList notes={current.map((x) => ({ key: x.id, target: noteTarget(deal, x.about), text: x.text }))} />
        </>
      ) : (
        <>
          {earlier.length > 0 && (
            <div className="grid gap-2">
              <h3 className="text-[13.5px] font-extrabold text-ink-3">On version {deal.version - 1}</h3>
              <NoteList notes={earlier.map((x) => ({ key: x.id, target: noteTarget(deal, x.about), text: x.text, reply: x.reply, creator }))} />
            </div>
          )}
          {deal.step === "waiting_for_brand" && (
            <>
              {n === 0 ? (
                <p className="text-meta text-ink-3">Nothing yet. Use “Ask for a change” on anything that’s wrong.</p>
              ) : (
                <NoteList notes={drafts} />
              )}
              <AskForChange about={{ kind: "deal" }} target="this deal" label="Anything else about this deal?" />
              {n > 0 && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={onSend}
                  className="inline-flex min-h-11 items-center justify-center rounded-pill border border-latte-line bg-surface px-[18px] text-[14.5px] font-bold text-espresso disabled:opacity-50"
                >
                  {`Send ${n} ${n === 1 ? "change" : "changes"} to ${creator}`}
                </button>
              )}
              {failed && (
                <p role="alert" className="text-meta font-bold text-fail">
                  Your notes didn’t send. Try again.
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function NoteList({ notes }: { notes: { key: string; target: string; text: string; reply?: string; creator?: string }[] }) {
  return (
    <ul className="grid gap-2.5 text-[13.5px] text-ink-2">
      {notes.map((note) => (
        <li key={note.key}>
          <b className="text-ink">{note.target}:</b> <span className="whitespace-pre-wrap">{note.text}</span>
          {note.reply && (
            <p className="mt-1 text-ink-3">
              {note.creator} replied: <span className="whitespace-pre-wrap text-ink-2">{note.reply}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
