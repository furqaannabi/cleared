import { PaymentRules } from "@/components/invite/payment-rules";
import { formatAmount } from "@/lib/invite/amount";
import type { BrandTermsView } from "@/lib/brand-deal/terms-view";
import type { BrandDeal } from "@/lib/brand-deal/types";
import { BrandPostLine } from "./brand-post";
import { NotOnChecklist } from "./not-on-checklist";

/**
 * The sponsorship terms as the brand reads them (design A,
 * design/brand-deal/option-a.html): the creator and brand, each post with its
 * checklist under it, the total, where the money goes (never the creator's
 * PayPal email), the lines not on the checklist and the four payment rules.
 *
 * @param deal - the deal as the brand sees it
 * @param view - the brand terms view
 * @see docs/specs/confirm-and-hold-frd.md CH-FR-05 to CH-FR-09, CH-BR-08
 */
export function BrandTermsSheet({ deal, view }: { deal: BrandDeal; view: BrandTermsView }) {
  const creator = deal.creatorName;
  return (
    <section
      aria-labelledby="terms-heading"
      className="relative overflow-hidden rounded-t-[6px] rounded-b-[20px] border border-line bg-surface px-[18px] pt-[26px] pb-6 shadow-panel before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-marigold md:px-10 md:pt-9 md:pb-8"
    >
      {deal.agreedAt ? (
        <p className="mb-2.5 text-[13.5px] font-bold text-ink-2">
          Agreed · version {deal.version} · {new Date(deal.agreedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </p>
      ) : (
        deal.version > 1 && <p className="mb-2.5 text-[13.5px] font-bold text-ink-2">Version {deal.version}</p>
      )}
      <h2 id="terms-heading" className="font-head text-[26px] leading-[1.1] font-extrabold tracking-[-0.015em]">
        Sponsorship terms
      </h2>
      <dl className="my-5 grid grid-cols-2 gap-4 text-[15px]">
        <div>
          <dt className="text-[12.5px] font-bold text-ink-4">Creator</dt>
          <dd className="font-bold">{creator}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] font-bold text-ink-4">Brand</dt>
          <dd className="font-bold">{deal.brandName}</dd>
        </div>
      </dl>
      <div className="border-t border-ink">
        {view.posts.map((post) => (
          <BrandPostLine key={post.deliverableId} post={post} creator={creator} />
        ))}
      </div>
      <p className="flex items-baseline justify-between gap-3 border-t border-line pt-4 pb-1">
        <span className="font-bold">Total, held as one hold per post</span>
        <b className="font-head text-[30px] font-extrabold tracking-[-0.02em]">{formatAmount(view.total)}</b>
      </p>
      <p className="text-meta text-ink-3">Paid to {creator}’s PayPal.</p>
      <NotOnChecklist lines={view.notOnChecklist} creator={creator} />
      <PaymentRules side="brand" brand={deal.brandName} creator={creator} />
    </section>
  );
}
