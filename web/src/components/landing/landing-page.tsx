import { Closing, LandingFooter } from "./closing-and-footer";
import { DealSteps } from "./deal-steps";
import { Hero } from "./hero";
import { LandingHeader } from "./landing-header";
import { ProblemChat } from "./problem-chat";
import { ForTheBrand, Rules } from "./rules-and-brand";
import "./landing.css";
import { SignedInProvider } from "./way-in";

/**
 * The landing page at `/`, written for creators: what Cleared does, the
 * product itself, one deal from start to paid, the rules that protect the
 * creator, a note for the brand, and one way in, "Sign in with Google" (LP 1.3).
 * Static and the same for everyone; once loaded, one `GET /me` in the browser
 * turns the buttons into "Open your deals" for a signed-in creator
 * (LP-FR-18). Motion is CSS.
 *
 * @see docs/specs/landing-frd.md
 */
export function LandingPage() {
  return (
    <div className="overflow-x-clip">
      <SignedInProvider>
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
      </SignedInProvider>
    </div>
  );
}
