"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { removeObjection, saveObjection, type Objection } from "@/lib/brand-review/objection-draft";
import type { BrandDeliverable } from "@/lib/brand-review/types";

/** What the brand is confirming in place, if anything (RW-FR-16, RW-FR-18). */
export type Confirming = "approve" | "send" | "confirm_post" | "accept_post" | null;

/**
 * The brand's answers on one post: objections being written (memory only,
 * DC-BR-08), answering asks, approving and sending, each from what the API
 * returns. A send refused because the window ended reloads the post and keeps
 * the unsent notes to copy (RW-FR-20).
 *
 * @param post - the post as the brand sees it
 * @param setPost - takes what a saved change returned
 * @param reload - asks the API for the post again
 * @see docs/specs/brand-review-frd.md RW-FR-12 to RW-FR-21
 */
export function useReviewActions(post: BrandDeliverable, setPost: (p: BrandDeliverable) => void, reload: () => Promise<BrandDeliverable | null>) {
  const items = post.draft?.items ?? [];
  const [objections, setObjections] = useState<Objection[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editProblem, setEditProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [unsent, setUnsent] = useState<Objection[] | null>(null);
  const [objecting, setObjecting] = useState(false);
  const [objectProblem, setObjectProblem] = useState<string | null>(null);
  const ids = { dealId: post.dealId, deliverableId: post.deliverableId };

  async function run(call: () => ReturnType<typeof api.approveDraft>, onRefused?: (fresh: BrandDeliverable | null) => void) {
    setBusy(true);
    setProblem(null);
    const r = await call();
    setBusy(false);
    setConfirming(null);
    if (r.ok) {
      setPost(r.data);
      return true;
    }
    if (r.error !== "rejected") {
      setProblem("We couldn’t reach Cleared. Try again.");
      return false;
    }
    const fresh = await reload();
    if (onRefused) onRefused(fresh);
    else setProblem("That didn’t go through. The page has the latest.");
    return false;
  }

  return {
    objections,
    editing,
    editProblem,
    confirming,
    busy,
    problem,
    unsent,
    objecting,
    objectProblem,
    edit(itemId: string | null) {
      setEditing(itemId);
      setEditProblem(null);
    },
    save(itemId: string, note: string) {
      const r = saveObjection(objections, items, itemId, note);
      if (!r.ok) return setEditProblem(r.problem);
      setObjections(r.objections);
      setEditing(null);
      setEditProblem(null);
    },
    remove: (itemId: string) => setObjections(removeObjection(objections, itemId)),
    confirm: setConfirming,
    approve: () => run(() => api.approveDraft(ids.dealId, ids.deliverableId)),
    send: () =>
      run(
        () => api.sendObjections(ids.dealId, ids.deliverableId, objections),
        (fresh) => {
          // RW-FR-20: the window ended before the send; keep the notes to copy.
          if (fresh?.review.state === "approved") setUnsent(objections);
          else setProblem("That didn’t go through. The page has the latest.");
          setObjections([]);
        },
      ).then((ok) => ok && setObjections([])),
    // PP-FR-27, PP-FR-28: the brand's decisions on a live post.
    confirmPost: () => run(() => api.confirmPost(ids.dealId, ids.deliverableId)),
    acceptPost: () => run(() => api.acceptPost(ids.dealId, ids.deliverableId)),
    openObjection(open: boolean) {
      setObjecting(open);
      setObjectProblem(null);
    },
    async objectToPost(reason: string) {
      const text = reason.trim();
      if (!text) return setObjectProblem("Say why you’re objecting.");
      if (text.length > 500) return setObjectProblem("Keep it to 500 characters.");
      if (await run(() => api.objectToPost(ids.dealId, ids.deliverableId, text))) setObjecting(false);
    },
    accept: (itemId: string) => run(() => api.acceptItem(ids.dealId, ids.deliverableId, itemId)),
    askToFix: (itemId: string, note: string) => run(() => api.askToFix(ids.dealId, ids.deliverableId, itemId, note.trim() || undefined)),
  };
}

export type ReviewActions = ReturnType<typeof useReviewActions>;
