/** LP-FR-04 (1.2): the honest note under the two ways in. */
export function DemoNote({ onDark = false }: { onDark?: boolean }) {
  return <p className={`mt-2.5 text-[13.5px] ${onDark ? "text-white/75" : "text-ink-3"}`}>The demo account has made-up data. No real money moves.</p>;
}
