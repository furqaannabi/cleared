import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { InstagramOnlyNote, SignInButton } from "./sign-in-buttons";

/**
 * `/sign-in`: the Cleared mark, "Sign in to see your deals" and "Sign in
 * with Google", which returns the creator to `next` (SI-FR-06). Nothing else.
 *
 * @param next - where the creator was going
 * @see docs/specs/sign-in-frd.md SI-FR-05, SI-FR-06; design/sign-in/shared.html
 */
export function SignInPage({ next }: { next?: string | null }) {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-ground px-4 py-10">
      <div className="grid w-full max-w-[380px] justify-items-center gap-4 text-center">
        <Logo tone="light" />
        <h1 className="font-head text-[28px] leading-tight font-bold">Sign in to see your deals</h1>
        <SignInButton next={next} fullWidth />
        <InstagramOnlyNote />
        {/* SI-FR-01 (1.3, 1.4). */}
        <p className="text-[13.5px] text-ink-3">
          By signing in you agree to the{" "}
          <Link href="/terms" className="font-bold text-espresso underline underline-offset-2">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-bold text-espresso underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
