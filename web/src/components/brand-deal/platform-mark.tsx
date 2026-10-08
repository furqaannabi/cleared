import type { BrandPost } from "@/lib/brand-deal/types";

/**
 * A post's platform as a small tinted square: YouTube's play mark or
 * Instagram's camera. Decorative; the post's name beside it carries the meaning.
 *
 * @param platform - the post's platform
 */
export function PlatformMark({ platform }: { platform: BrandPost["platform"] }) {
  const instagram = platform === "instagram_reel";
  return (
    <span aria-hidden="true" className={`grid size-[34px] shrink-0 place-items-center rounded-sm ${instagram ? "bg-avatar-rose text-avatar-rose-ink" : "bg-fail-wash text-fail"}`}>
      {instagram ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-[18px]">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-[18px]">
          <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="none" stroke="currentColor" strokeWidth={2} />
          <path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
