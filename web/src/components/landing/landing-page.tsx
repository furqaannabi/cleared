import { Closing, LandingFooter } from "./closing-and-footer";
import { DealSteps } from "./deal-steps";
import { Hero } from "./hero";
import { LandingHeader } from "./landing-header";
import { ProblemChat } from "./problem-chat";
import { ForTheBrand, Rules } from "./rules-and-brand";
import "./landing.css";

/**
 * The landing page at `/`, written for creators: what Cleared does, the
 * product itself, one deal from start to paid, the rules that protect the
 * creator, a note for the brand, and two ways in ("Sign in with Google", "Try the demo account").
 * Static: no client JavaScript of its own; motion is CSS.
 *
 * @see docs/specs/landing-frd.md
 */
export function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <LandingHeader />
      <main id="main">
        <Hero />
        <ProblemChat />
        <DealSteps />
        <Rules />
        <ForTheBrand />
        <Closing />
      </main>
      <LandingFooter />
    </div>
  );
}
