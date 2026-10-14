import { Seal } from "@/components/ui/seal";

/**
 * The Sponing wordmark: a marigold seal with a check, and the name in Bricolage (DESIGN.md "Navigation").
 *
 * @param compact - the smaller size, for the phone top bar
 * @param mark - the seal alone, for the folded rail (DC-FR-55)
 * @param tone - "dark" (white name, for espresso) or "light" (ink name, for the landing page's light ground)
 */
export function Logo({ compact = false, tone = "dark", mark = false }: { compact?: boolean; tone?: "dark" | "light"; mark?: boolean }) {
  return (
    <span
      className={`flex items-center gap-2.5 font-head font-extrabold ${tone === "light" ? "text-ink" : "text-white"} ${compact ? "text-logo-compact" : "text-logo"}`}
    >
      <Seal fillClassName="fill-marigold" className={compact ? "size-6" : "size-[26px]"}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-full text-espresso-deep">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </Seal>
      {!mark && "Sponing"}
    </span>
  );
}
