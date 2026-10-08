import { DemoButton, DemoNote } from "./demo-button";

/**
 * The closing band: the one action again before the footer.
 *
 * @see docs/specs/landing-frd.md LP-FR-17
 */
export function Closing() {
  return (
    <div className="mx-auto mt-14 max-w-[1180px] px-4 md:px-8">
      <section aria-labelledby="close-heading" className="lp-close rounded-[28px] bg-espresso px-6 py-9 text-center text-white">
        <h2 id="close-heading" className="font-head text-[28px] leading-[1.1] font-extrabold tracking-[-0.015em] md:text-[38px]">
          See a whole deal clear.
        </h2>
        <div className="mt-[18px]">
          <DemoButton tone="marigold" />
        </div>
        <DemoNote onDark />
      </section>
    </div>
  );
}

const REPO = "https://github.com/furqaannabi/cleared";

/**
 * The footer: the hackathon, sandbox only, the PayPal and AI technology and
 * sponsor tools used, and the repository with its licence.
 *
 * @see docs/specs/landing-frd.md LP-FR-12
 */
export function LandingFooter() {
  return (
    <footer className="mt-14 bg-espresso-deep py-10 text-sm text-white/80">
      <div className="mx-auto grid max-w-[1180px] gap-[18px] px-4 md:grid-cols-[1.2fr_1fr_1fr] md:px-8">
        <p>
          <b className="mb-1 block text-white">Built for the PayPal AI Hackathon</b>
          PayPal sandbox only. No real money moves.
        </p>
        <p>
          <b className="mb-1 block text-white">Uses</b>
          PayPal holds, capture and payouts · Claude on Amazon Bedrock · AG Grid · APIMatic
        </p>
        <p>
          <b className="mb-1 block text-white">Open source</b>
          <a href={REPO} className="inline-flex min-h-11 items-center text-white underline underline-offset-2">
            GitHub repository
          </a>
          {" · "}
          <a href={`${REPO}/blob/main/LICENSE`} className="inline-flex min-h-11 items-center text-white underline underline-offset-2">
            MIT licence
          </a>
        </p>
      </div>
    </footer>
  );
}
