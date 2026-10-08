"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BrandFrame, BrandMessage } from "@/components/brand-deal/brand-frame";
import { PlatformMark } from "@/components/brand-deal/platform-mark";
import { ChecklistItems } from "@/components/checklist/checklist-items";
import { ChecklistWordsProvider, type ChecklistWords } from "@/components/checklist/checklist-words";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { DraftPlayer } from "@/components/player/draft-player";
import { SeekProvider } from "@/components/player/seek";
import { api } from "@/lib/api";
import { toItemViews } from "@/lib/brand-review/item-views";
import { brandReviewView } from "@/lib/brand-review/review-view";
import type { BrandDeliverable } from "@/lib/brand-review/types";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import { formatDay } from "@/lib/deliverable/format";
import { formatAmount } from "@/lib/invite/amount";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { ItemReviewActions } from "./item-review-actions";
import { ReviewPanel } from "./review-panel";
import { ReviewDock } from "./review-dock";
import { CancelPost } from "@/components/cancel/cancel-post";
import { brandCancelInfo } from "@/lib/cancel/cancel-view";
import { useBrandDeliverable } from "./use-brand-deliverable";
import { useReviewActions } from "./use-review-actions";

/**
 * The brand's review of one post (design A): the creator's draft check seen
 * from the brand's side. The player and the checklist (AG Grid from `md:`,
 * cards on phones) with "Your review" beside them from `lg:` (first on
 * phones, with a dock for its actions) and the post's hold.
 *
 * @param dealId - the deal, from the URL
 * @param deliverableId - the post, from the URL
 * @see docs/specs/brand-review-frd.md RW-FR-04 to RW-FR-30
 */
export function BrandReviewPage({ dealId, deliverableId }: { dealId: string; deliverableId: string }) {
  const { post, error, setPost, reload } = useBrandDeliverable(dealId, deliverableId);
  if (error === "not_found")
    return (
      <BrandFrame>
        {/* RW-FR-04, RW-FR-05: one answer for no session and for a post outside the deal; the session decides which. */}
        <NotFound dealId={dealId} />
      </BrandFrame>
    );
  if (error)
    return (
      <BrandFrame>
        <BrandMessage title="We couldn’t load this post">Check your connection and reload the page.</BrandMessage>
      </BrandFrame>
    );
  if (!post)
    return (
      <BrandFrame>
        <p role="status" className="py-10 text-ink-3">
          Loading the draft…
        </p>
      </BrandFrame>
    );
  return <Review post={post} setPost={setPost} reload={reload} />;
}

function NotFound({ dealId }: { dealId: string }) {
  // With a session for the deal, the post isn't in it; without one, the brand needs its link.
  const [inDeal, setInDeal] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    api.getBrandDeal(dealId).then((r) => live && setInDeal(r.ok));
    return () => {
      live = false;
    };
  }, [dealId]);
  if (inDeal === null) return null;
  return inDeal ? (
    <BrandMessage title="We couldn’t find this post">
      It isn’t part of this deal. <Link href={`/brand/deals/${dealId}`} className="font-bold text-espresso underline underline-offset-3">Back to your deal</Link>
    </BrandMessage>
  ) : (
    <BrandMessage title="Open the link you were sent again">For your security, this page only opens from the link the creator sent you.</BrandMessage>
  );
}

function Review({ post, setPost, reload }: { post: BrandDeliverable; setPost: (p: BrandDeliverable) => void; reload: () => Promise<BrandDeliverable | null> }) {
  const [now, setNow] = useState(() => new Date());
  // RW-FR-15: the time left moves on; the API still decides when the window ends.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const view = useMemo(() => brandReviewView(post, now), [post, now]);
  const actions = useReviewActions(post, setPost, reload);
  const items = useMemo(() => toItemViews(view.items), [view.items]);
  const words = useMemo<ChecklistWords>(() => {
    const labels = new Map(view.items.map((i) => [i.id, i.status.label]));
    return { status: (i) => labels.get(i.id) ?? "", addedBy: `Added by ${post.creatorName}` };
  }, [view.items, post.creatorName]);
  const [selectedId, setSelectedId] = useState<string | null>(view.selectedId);
  const [seekKey, setSeekKey] = useState(0);
  const seek = useCallback((id: string) => {
    setSelectedId(id);
    setSeekKey((k) => k + 1);
  }, []);
  const wide = useMediaQuery("(min-width: 768px)");
  const label = PLATFORM_LABEL[post.platform];
  const selected = view.items.find((i) => i.id === selectedId) ?? null;
  const renderActions = (id: string) => {
    const item = view.items.find((i) => i.id === id);
    return item && <ItemReviewActions item={item} view={view} creator={post.creatorName} actions={actions} />;
  };
  const refreshUrl = async () => (await reload())?.draft?.url ?? null;

  return (
    <BrandFrame invited={{ creator: post.creatorName, brand: post.brandName }}>
      <title>{`${label} · ${post.brandName} × ${post.creatorName} · Cleared`}</title>
      <ChecklistWordsProvider words={words}>
        <SeekProvider seek={post.draft ? seek : null}>
          <Link href={`/brand/deals/${post.dealId}`} className="inline-flex min-h-11 items-center text-[13.5px] font-bold text-espresso underline underline-offset-3">
            {post.brandName} × {post.creatorName}
          </Link>
          <div className="flex items-center gap-3">
            <PlatformMark platform={post.platform} />
            <h1 className="font-head text-page-title-phone font-bold tracking-[-0.01em] md:text-page-title">{label}</h1>
          </div>
          {/* PP-FR-26: the live post, on the platform (its link is checked to be the platform's own, PP-BR-05). */}
          {post.post && (
            <p className="mt-1 text-[14px] text-ink-3">
              <a href={post.post.url} target="_blank" rel="noopener noreferrer" className="font-bold text-espresso underline underline-offset-3">
                View the live post
              </a>
            </p>
          )}

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:grid-rows-[auto_1fr] lg:gap-7">
            <div className="lg:col-start-2 lg:row-start-1">
              <ReviewPanel post={post} view={view} actions={actions} />
            </div>
            <div className="grid min-w-0 gap-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
              {post.draft && (
                <>
                  <DraftPlayer
                    draft={{ ...post.draft, fileName: `from ${post.creatorName}` }}
                    platform={post.platform}
                    items={items}
                    brandName={post.brandName}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    refreshUrl={refreshUrl}
                    seekKey={seekKey}
                  />
                  {wide && <EvidencePanel item={items.find((i) => i.id === selectedId) ?? null} brandName={post.brandName} actions={selected && renderActions(selected.id)} />}
                  <section aria-label="Checklist" className="grid gap-3">
                    <h2 className="font-head text-section-title font-bold">Checklist · {items.length} items</h2>
                    <ChecklistItems items={items} brandName={post.brandName} selectedId={selectedId} onSelect={setSelectedId} renderActions={(i) => renderActions(i.id)} />
                  </section>
                </>
              )}
            </div>
            {/* CN-FR-01: "Cancel this post" under the hold; the hold turns over to confirm (design B). */}
            <div className="lg:col-start-2 lg:row-start-2">
              <CancelPost
                post={brandCancelInfo(post)}
                side="brand"
                creatorName={post.creatorName}
                send={(note) => api.cancelBrandDeliverable(post.dealId, post.deliverableId, note)}
                reload={async () => {
                  const r = await api.getBrandDeliverable(post.dealId, post.deliverableId);
                  return r.ok ? r.data : null;
                }}
                onUpdated={setPost}
              >
                <section aria-label="The hold" className="grid gap-1 rounded-[18px] border border-line bg-surface p-[18px] text-[13.5px] text-ink-2">
                  {post.review.state === "released" ? (
                    <p className="font-bold text-ink">Released · {formatAmount(post.hold.amount)}</p>
                  ) : (
                    <>
                      <p className="font-bold text-ink">Held · {formatAmount(post.hold.amount)}</p>
                      <p>PayPal ref {post.hold.reference}</p>
                      <p>
                        {post.creatorName} posts by <b className="text-ink">{formatDay(post.hold.deadline, post.creatorTimeZone)}</b>. Your money is taken only once the live post checks out.
                      </p>
                    </>
                  )}
                </section>
              </CancelPost>
            </div>
          </div>
          <ReviewDock view={view} actions={actions} creator={post.creatorName} />
        </SeekProvider>
      </ChecklistWordsProvider>
    </BrandFrame>
  );
}
