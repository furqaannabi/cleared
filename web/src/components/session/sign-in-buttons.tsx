import { apiBaseUrl } from "@/lib/api";
import { safeNext } from "@/lib/session/sign-in-path";

const GOOGLE =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-pill bg-espresso px-[22px] text-body-strong font-bold text-surface shadow-[0_2px_6px_rgb(28_21_10/0.2)] hover:bg-espresso-hover";

/**
 * "Sign in with Google": a plain link to the backend's sign-in, carrying a
 * safe `next`. The page holds no Google code and never sees a token
 * (SI-BR-01). There is no other way in (1.1: no demo account).
 *
 * @param next - where to return after signing in, if anywhere
 * @param fullWidth - full width (the sign-in page) rather than its own width (the landing)
 * @param onDark - on the espresso closing band
 * @see docs/specs/sign-in-frd.md SI-FR-01, SI-FR-06; docs/specs/landing-frd.md LP-FR-03
 */
export function SignInButton({ next, fullWidth = false, onDark = false }: { next?: string | null; fullWidth?: boolean; onDark?: boolean }) {
  const safe = safeNext(next);
  const q = safe ? `?next=${encodeURIComponent(safe)}` : "";
  return (
    <a
      href={`${apiBaseUrl}/auth/google${q}`}
      className={`${GOOGLE} ${fullWidth ? "w-full" : ""} ${onDark ? "bg-marigold text-marigold-ink hover:bg-marigold-chip" : ""}`}
    >
      <GoogleMark />
      Sign in with Google
    </a>
  );
}

/** SI-FR-01: under the button, for creators who only use Instagram. */
export function InstagramOnlyNote({ onDark = false }: { onDark?: boolean }) {
  return <p className={`text-[13.5px] ${onDark ? "text-white/75" : "text-ink-3"}`}>Instagram-only? Sign in with any Google account, then connect your Instagram.</p>;
}

function GoogleMark() {
  return (
    <span aria-hidden="true" className="grid size-[22px] place-items-center rounded-full bg-white">
      <svg width="14" height="14" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
        <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
      </svg>
    </span>
  );
}
