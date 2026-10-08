import type { DealDraft } from "./types";

/** The set-up steps, in order. */
export type SetupStep = "posts" | "brief" | "checklist" | "invite";

/**
 * Where each set-up step already reached links to (BC-FR-22). Posts link
 * only while they can still change: before the brief is sent, or after it
 * couldn't be read (BC-FR-23). Steps not reached have no link.
 *
 * @param deal - the deal's id, step and reading state
 * @returns a link per reached step
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-22, BC-FR-23
 */
export function stepLinks(deal: Pick<DealDraft, "id" | "step" | "reading">): Partial<Record<SetupStep, string>> {
  const base = `/deals/${encodeURIComponent(deal.id)}`;
  const links: Partial<Record<SetupStep, string>> = {};
  if (deal.reading === "idle" || deal.reading === "failed") links.posts = `${base}/posts`;
  links.brief = `${base}/checklist#brief`;
  if (deal.reading === "done") links.checklist = `${base}/checklist`;
  if (deal.step !== "checklist") links.invite = `${base}/invite`;
  return links;
}
