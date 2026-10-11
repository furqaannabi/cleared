import type { UploadProblem } from "@/lib/draft/upload-problem";
import { formatMoney } from "@/lib/deliverable/format";
import type { Deliverable } from "@/lib/deliverable/types";
import { CheckFailedBanner } from "./check-failed-banner";
import { DraftLimitBanner } from "./draft-limit-banner";

/**
 * Why the last draft didn't go, in the draft area: a file problem in the
 * check-failed banner's look (DC-FR-08), a limit (DC-FR-53), or a short line
 * asking to try again.
 *
 * @param problem - from the upload, or null
 * @param deliverable - the post, for its hold
 * @see docs/specs/creator-draft-check-frd.md DC-FR-45 (1.18), DC-FR-53
 */
export function UploadNotices({ problem, deliverable }: { problem: UploadProblem | null; deliverable: Deliverable }) {
  if (!problem) return null;
  if (problem.show === "file")
    return (
      <div role="alert">
        <CheckFailedBanner
          banner={{ kind: "file", heading: problem.heading, body: problem.body, hold: `Your ${formatMoney(deliverable.hold.amountMinor, deliverable.hold.currency)} hold is still in place`, showing: null }}
        />
      </div>
    );
  if (problem.show === "limit") return <DraftLimitBanner post={problem.post} heading={problem.heading} body={problem.body} />;
  if (problem.show === "failed")
    return (
      <p role="alert" className="mt-5 text-meta font-bold text-fail">
        {problem.message}
      </p>
    );
  return null;
}
