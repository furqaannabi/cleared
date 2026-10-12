import Link from "next/link";
import type { DealGroup, HomeDeal } from "@/lib/home/deal-groups";
import { ArrowIcon, CheckIcon, ClockIcon, CrossIcon } from "./icons";

type Post = HomeDeal["posts"][number];

const YT = "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15V9l5.2 3Z";

function Mark({ platform }: { platform: Post["platform"] }) {
  if (platform === "instagram_reel") {
    return (
      <span aria-hidden="true" className="grid size-[30px] flex-none place-items-center rounded-[9px] bg-[#f6e7f2] text-[#a2347a]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="grid size-[30px] flex-none place-items-center rounded-[9px] bg-[#fde8e6] text-[#c4302b]">
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
        <path d={YT} />
      </svg>
    </span>
  );
}

/** A post's step as an icon and a word: a fix or a stuck payout in the fail colour, paid in the pass colour, the rest plain. */
function Step({ post }: { post: Post }) {
  if (post.stuck || post.state === "check_failed" || post.state === "results" || post.state === "objected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-fail">
        <CrossIcon className="size-3.5" />
        {post.words}
      </span>
    );
  }
  if (post.state === "paid") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-pass">
        <CheckIcon className="size-3.5" />
        {post.words}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
      <ClockIcon className="size-3.5" />
      {post.words}
    </span>
  );
}

/**
 * The creator's deals on home, in Needs you, Under way and Finished: each row
 * the brand, each post's platform and step, linking to the deal. A deal before
 * agreeing shows its status line.
 *
 * @param groups - the deals in their groups
 * @see docs/specs/creator-home-frd.md HM-FR-15; DESIGN.md "Creator home"
 */
export function HomeDeals({ groups }: { groups: DealGroup[] }) {
  return (
    <section aria-labelledby="home-deals" className="mt-7">
      <h2 id="home-deals" className="font-head text-section-title font-bold">
        Deals
      </h2>
      <div className="mt-3 rounded-lg border border-line bg-surface px-[18px] py-1.5 shadow-panel md:px-[26px] md:py-2">
        {groups.map((g) => (
          <section key={g.name} aria-labelledby={`home-group-${g.name}`} className="py-3 not-first:border-t not-first:border-line">
            <h3 id={`home-group-${g.name}`} className="flex items-center gap-2 text-[13.5px] font-bold text-ink-2">
              {g.name}
              <span className="text-label font-semibold text-ink-3">{g.deals.length}</span>
            </h3>
            <ul>
              {g.deals.map((d) => (
                <li key={d.id} className="not-first:border-t not-first:border-line-soft">
                  <Link href={d.href} className="grid min-h-11 grid-cols-[1fr_18px] items-center gap-x-3 gap-y-1.5 py-3 md:grid-cols-[220px_1fr_18px]">
                    <span className="text-[15.5px] font-extrabold">{d.brandName}</span>
                    <span className="col-start-1 grid gap-2 md:col-start-2 md:row-start-1 md:grid-cols-2">
                      {d.posts.length === 0 ? (
                        <span className="text-[13.5px] text-ink-2">{d.status}</span>
                      ) : (
                        d.posts.map((p) => (
                          <span key={p.id} className="flex items-center gap-2.5">
                            <Mark platform={p.platform} />
                            <span className="flex flex-col">
                              <span className="text-[13.5px] text-ink-2">{p.post}</span>
                              <Step post={p} />
                            </span>
                          </span>
                        ))
                      )}
                    </span>
                    <span className="col-start-2 row-span-2 row-start-1 text-ink-3 md:col-start-3 md:row-span-1">
                      <ArrowIcon />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
