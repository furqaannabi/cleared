"use client";

import { useState } from "react";
import { SendBar } from "@/components/ui/send-bar";
import { useNotes } from "./notes";

/**
 * The brand's unsent notes on the terms in the send bar, once one is saved:
 * "{n} changes for {creator}", what they're about, "Send to {creator}", and
 * the confirmation in the bar. Nothing once none are saved.
 *
 * @param creator - the creator, named on Send
 * @param sending - whether the notes are being sent
 * @param problem - why the last send failed, if it did
 * @param onSend - sends the notes
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-11 (1.10)
 */
export function ChangesBar({ creator, sending, problem, onSend }: { creator: string; sending: boolean; problem: string | null; onSend: () => void }) {
  const { editable, drafts } = useNotes();
  const [confirming, setConfirming] = useState(false);
  const n = drafts.length;
  if (!editable || n === 0) return null;
  const count = `${n} ${n === 1 ? "change" : "changes"}`;
  return (
    <SendBar
      label="Your unsent changes"
      summary={`${count} for ${creator}`}
      notes={drafts.map((d) => ({ key: d.key, about: d.target, note: d.text }))}
      sendLabel={`Send to ${creator}`}
      confirming={confirming}
      question={`Send ${count}?`}
      detail={` ${creator} updates the terms and sends you a new version.`}
      busy={sending}
      problem={problem}
      onOpen={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      onYes={onSend}
    />
  );
}
