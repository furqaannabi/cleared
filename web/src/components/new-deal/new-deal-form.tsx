"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import type { DealDraft } from "@/lib/checklist-builder/types";

type Platform = DealDraft["deliverables"][number]["platform"];
const PLATFORMS = Object.keys(PLATFORM_LABEL) as Platform[];
const MAX_POSTS = 10;

/**
 * Stage 1 of a new deal: the brand's name and its posts (deliverables), each
 * with a platform. "Continue" creates the deal and opens its checklist page.
 *
 * @see docs/specs/creator-brief-checklist-frd.md BC-FR-02, BC-FR-03
 */
export function NewDealForm() {
  const router = useRouter();
  const brandId = useId();
  const [brand, setBrand] = useState("");
  const [posts, setPosts] = useState<{ key: number; platform: Platform }[]>([{ key: 0, platform: "youtube_video" }]);
  const [missingBrand, setMissingBrand] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brand.trim()) {
      setMissingBrand(true);
      return;
    }
    setSending(true);
    setProblem(null);
    const r = await api.createDeal({ brandName: brand.trim(), deliverables: posts.map((p) => ({ platform: p.platform })) });
    if (r.ok) router.push(`/deals/${encodeURIComponent(r.data.id)}/checklist`);
    else {
      setSending(false);
      setProblem("We couldn’t create the deal. Try again.");
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 grid max-w-xl gap-6">
      <div className="grid gap-2">
        <label htmlFor={brandId} className="text-body-strong font-bold">
          Brand
        </label>
        <input
          id={brandId}
          value={brand}
          maxLength={120}
          autoComplete="organization"
          aria-invalid={missingBrand || undefined}
          aria-describedby={missingBrand ? `${brandId}-err` : undefined}
          onChange={(e) => {
            setBrand(e.target.value);
            if (e.target.value.trim()) setMissingBrand(false);
          }}
          className="min-h-12 rounded-md border border-line bg-surface px-3.5 text-body-strong aria-invalid:border-fail"
          placeholder="Glow Theory"
        />
        {missingBrand && (
          <p id={`${brandId}-err`} className="text-meta font-semibold text-fail">
            Add the brand’s name.
          </p>
        )}
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-body-strong font-bold">Posts</legend>
        <p className="-mt-1 text-meta text-ink-3">One deliverable each, with its own checklist.</p>
        {posts.map((p, i) => (
          <div key={p.key} className="flex items-center gap-2.5">
            <label htmlFor={`${brandId}-post-${p.key}`} className="sr-only">
              Post {i + 1}
            </label>
            <span aria-hidden="true" className="w-14 shrink-0 text-meta font-bold text-ink-3">
              Post {i + 1}
            </span>
            <Select
              id={`${brandId}-post-${p.key}`}
              value={p.platform}
              onChange={(e) => setPosts(posts.map((x) => (x.key === p.key ? { ...x, platform: e.target.value as Platform } : x)))}
              className="min-h-12"
            >
              {PLATFORMS.map((pl) => (
                <option key={pl} value={pl}>
                  {PLATFORM_LABEL[pl]}
                </option>
              ))}
            </Select>
            {posts.length > 1 && (
              <button
                type="button"
                aria-label={`Remove post ${i + 1}`}
                onClick={() => setPosts(posts.filter((x) => x.key !== p.key))}
                className="grid size-11 shrink-0 place-items-center rounded-pill text-ink-3 hover:bg-latte"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true" className="size-4">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {posts.length < MAX_POSTS && (
          <button
            type="button"
            onClick={() => setPosts([...posts, { key: Math.max(...posts.map((x) => x.key)) + 1, platform: "youtube_video" }])}
            className="inline-flex min-h-11 items-center gap-1.5 justify-self-start rounded-pill px-3 font-bold text-espresso hover:bg-latte"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true" className="size-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add another post
          </button>
        )}
      </fieldset>

      {problem && (
        <p role="alert" className="text-meta font-semibold text-fail">
          {problem}
        </p>
      )}
      <button
        type="submit"
        aria-busy={sending || undefined}
        disabled={sending}
        className="inline-flex min-h-12 items-center justify-center justify-self-start rounded-pill bg-espresso px-6 text-body-strong font-bold text-surface hover:bg-espresso-hover disabled:opacity-70"
      >
        Continue
      </button>
    </form>
  );
}
