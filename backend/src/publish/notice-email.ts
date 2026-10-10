/**
 * The words of the brand's two notices after a post is live (publish to paid spec PT-FR-21): which
 * post, what is asked, until when, and the link. Plain text, written by code. The names in it are
 * people's own text, so they are flattened to one line and never treated as anything but words.
 */
const PLATFORM: Record<string, string> = { youtube_video: "YouTube video", youtube_short: "YouTube Short", instagram_reel: "Instagram Reel" };

/** A name on one line, with nothing that could start a new line of a subject or a message. */
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim().slice(0, 120);

/** A moment as the brand reads it: the date and time in the deal's timezone, which is named. */
export function when(moment: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(moment);
  const part = (type: string) => parts.find((each) => each.type === type)?.value ?? "";
  return `${part("month")} ${part("day")}, ${part("year")} at ${part("hour")}:${part("minute")} ${part("dayPeriod")} (${timeZone})`;
}

export interface NoticeInput {
  /** confirm: the live check could not decide. accept: it failed on something that cannot be fixed. */
  kind: "confirm" | "accept";
  creatorName: string;
  brandName: string;
  platform: string;
  /** When the brand's 48 hours end. */
  endsAt: Date;
  timeZone: string;
  /** Why the post cannot be fixed, for an accept notice. */
  notFixable?: string | null;
  link: string;
}

export function noticeEmail(input: NoticeInput): { subject: string; text: string } {
  const creator = oneLine(input.creatorName);
  const brand = oneLine(input.brandName);
  const post = PLATFORM[input.platform] ?? "post";
  const by = when(input.endsAt, input.timeZone);
  const closing = ["Review the post:", input.link, "", "This link opens this deal on Cleared and nothing else. It stops working once you have decided, or when the time is up."];

  if (input.kind === "confirm") {
    return {
      subject: `Confirm ${creator}'s live post on Cleared`,
      text: [
        `${creator}'s ${post} for ${brand} is live.`,
        "",
        "Cleared could not check everything about it automatically, so it is yours to decide: confirm the post or object to it.",
        "",
        `If you say nothing by ${by}, your hold is taken and ${creator} is paid.`,
        "",
        ...closing,
      ].join("\n"),
    };
  }
  const why = input.notFixable === "not_your_channel" ? "it is not on the channel the deal was agreed for" : "it is not the video you approved";
  return {
    subject: `${creator}'s live post needs your decision on Cleared`,
    text: [
      `${creator}'s ${post} for ${brand} is live, but ${why}. That cannot be fixed once a post is public.`,
      "",
      "You can accept the post anyway.",
      "",
      `If you do not accept it by ${by}, your hold is released back to you and ${creator} is not paid.`,
      "",
      ...closing,
    ].join("\n"),
  };
}
