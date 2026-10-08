"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import type { DealDraft } from "@/lib/checklist-builder/types";
import { DealStepHeader } from "./deal-step-header";
import { NewDealForm } from "./new-deal-form";

type Platform = DealDraft["deliverables"][number]["platform"];

const HOW = [
  { step: "Posts", text: "The brand and each post you agreed." },
  { step: "Brief", text: "Paste what the brand sent. AI reads it line by line." },
  { step: "Checklist", text: "Every item cites the brief. You answer anything vague." },
  { step: "Invite", text: "Set amounts and deadlines, then send the brand a link to approve the hold." },
] as const;

/**
 * `/deals/new`: the step header, the form in a card, and beside it (from
 * `lg:`) a preview of the terms sheet filling in as the creator types, with
 * how setting up a deal works beneath. Phones show the steps under the form.
 *
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-01 to BC-FR-03, BC-FR-21
 */
export function NewDealPage() {
  const [deal, setDeal] = useState<{ brand: string; platforms: Platform[] }>({ brand: "", platforms: ["youtube_video"] });
  const [creator, setCreator] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    api.getProfile().then((r) => live && r.ok && setCreator(r.data.name));
    return () => {
      live = false;
    };
  }, []);
  const brand = deal.brand.trim();

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pt-4 pb-16 focus:outline-none md:px-6 lg:px-9">
      <DealStepHeader title="New deal" stage="posts" />
      <p className="mt-4 text-ink-2">Name the brand and the posts you agreed. Next you’ll paste their brief.</p>
      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,520px)_1fr] lg:gap-9">
        <div className="rounded-[20px] border border-line bg-surface px-[18px] py-[22px] shadow-panel md:px-[30px] md:py-7">
          <NewDealForm onChange={setDeal} />
        </div>
        <div className="grid gap-7">
          <section aria-labelledby="preview-heading" className="hidden lg:block">
            <h2 id="preview-heading" className="mb-2 text-body-strong font-normal text-ink-2">
              {`Taking shape: the terms ${brand || "the brand"} will see`}
            </h2>
            <div className="relative overflow-hidden rounded-t-[6px] rounded-b-[20px] border border-dashed border-latte-line bg-surface px-[26px] pt-7 pb-6 before:absolute before:inset-x-0 before:top-0 before:h-1.5 before:bg-marigold/60">
              <p aria-hidden="true" className="font-head text-[22px] font-extrabold tracking-[-0.015em]">
                Sponsorship terms
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-[15px]">
                <div>
                  <dt className="text-[12.5px] font-bold text-ink-4">Creator</dt>
                  <dd className="font-bold">{creator}</dd>
                </div>
                <div>
                  <dt className="text-[12.5px] font-bold text-ink-4">Brand</dt>
                  <dd className="font-bold">{brand || <span className="font-normal text-ink-4">The brand</span>}</dd>
                </div>
              </dl>
              <ul className="mt-3.5 border-t border-ink">
                {deal.platforms.map((p, i) => (
                  <li key={i} className="flex justify-between gap-3 border-b border-line py-3 text-[15px]">
                    <b>{PLATFORM_LABEL[p]}</b>
                    <span aria-hidden="true" className="text-ink-4">
                      Checklist from the brief
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3.5 text-meta text-ink-3">Amounts and deadlines come at the Invite step.</p>
            </div>
          </section>
          <section aria-labelledby="how-heading" className="border-t border-line pt-5 lg:border-0 lg:pt-0">
            <h2 id="how-heading" className="mb-3 font-head text-[17px] font-bold">
              How setting up a deal works
            </h2>
            <ol aria-labelledby="how-heading" className="grid gap-3 lg:gap-2.5">
              {HOW.map((h, i) => (
                <li key={h.step} aria-current={i === 0 ? "step" : undefined} className="grid grid-cols-[28px_1fr] gap-3 text-[14.5px] text-ink-2 lg:grid-cols-[24px_1fr] lg:text-[13.5px]">
                  <span aria-hidden="true" className={`grid size-7 place-items-center rounded-full text-[13px] font-extrabold lg:size-6 lg:text-xs ${i === 0 ? "bg-marigold text-marigold-ink" : "bg-latte text-ink-2"}`}>
                    {i + 1}
                  </span>
                  <span>
                    <b className="block text-[15px] text-ink lg:text-[14px]">{h.step}</b>
                    {h.text}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-meta text-ink-3">Nothing is held or paid until the brand approves.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
