/**
 * The problem in the creator's words, beside the chat every creator knows.
 * Illustrative: not a quote from a real person.
 *
 * @see docs/specs/landing-frd.md LP-FR-08
 */
export function ProblemChat() {
  const chat = [
    { day: "Day 12", from: "me", text: "Hi! Just checking in on the invoice for the video" },
    { day: "Day 15", from: "them", text: "It’s processing, should be soon!" },
    { day: "Day 34", from: "me", text: "Hey, any update? It’s been a month" },
    { day: "Day 41", from: "them", text: "Legal says the code wasn’t shown long enough. Can you re-edit?" },
    { day: "Day 41", from: "me", text: "It’s already live…" },
  ] as const;
  return (
    <section
      aria-labelledby="problem-heading"
      className="mx-auto mb-14 grid max-w-[1116px] gap-6 rounded-[28px] bg-espresso-deep px-[22px] py-7 text-white md:mx-8 lg:mx-auto lg:grid-cols-[1fr_1.1fr] lg:items-center lg:p-11"
    >
      <div>
        <h2 id="problem-heading" className="font-head text-[28px] leading-[1.1] font-extrabold tracking-[-0.015em] md:text-[38px]">
          You post. Then you chase payment.
        </h2>
        <p className="mt-2.5 max-w-[42ch] text-[17px] text-white/75">
          Weeks of “processing”. Then the brand says the video missed something, after it’s live and can’t be changed.
        </p>
      </div>
      <ol className="grid gap-2">
        {chat.map((m, i) => (
          <li
            key={i}
            className={`lp-bubble max-w-[80%] rounded-2xl px-[13px] py-[9px] text-[14.5px] leading-snug ${
              m.from === "me"
                ? "justify-self-end rounded-br-[5px] bg-marigold text-marigold-ink"
                : "justify-self-start rounded-bl-[5px] bg-white/10 text-white"
            }`}
          >
            {m.text}
            <small className="mt-0.5 block text-[11px] opacity-60">{m.day}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
