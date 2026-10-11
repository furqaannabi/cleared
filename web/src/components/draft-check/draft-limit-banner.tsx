import { Seal } from "@/components/ui/seal";

/**
 * A limit on drafts, in the draft area (design/draft-upload/shared.html): the
 * post's limit with a lock (its upload actions are hidden), or the daily
 * limit with a clock and when it lifts (uploading stays).
 *
 * @param post - the post's own limit, rather than everyone's daily one
 * @param heading - what was reached
 * @param body - what it means for this draft
 * @see docs/specs/creator-draft-check-frd.md DC-FR-53 (1.18)
 */
export function DraftLimitBanner({ post, heading, body }: { post: boolean; heading: string; body: string }) {
  return (
    <section role="alert" aria-label={heading} className="mt-5 grid grid-cols-[32px_1fr] items-start gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 md:grid-cols-[40px_1fr] md:gap-3.5 md:px-5 md:py-4">
      <Seal fillClassName={post ? "fill-waiting-wash" : "fill-unsure-wash"} className="size-8 md:size-10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`size-full ${post ? "text-waiting" : "text-unsure"}`}>
          {post ? (
            <>
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </>
          ) : (
            <>
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l3 2" />
            </>
          )}
        </svg>
      </Seal>
      <div className="min-w-0">
        <h2 className="text-[15px] leading-snug font-bold">{heading}</h2>
        <p className="mt-0.5 max-w-[72ch] text-[14px] text-ink-2 md:text-body">{body}</p>
      </div>
    </section>
  );
}
