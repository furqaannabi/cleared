import { PLATFORM_LABEL } from "@/lib/checklist-builder/checklist-view";
import { sumAmounts } from "./amount";
import type { CreatorProfile, DealInvite, InvitePost } from "./types";

type Account = CreatorProfile["accounts"][number]["platform"];

const ACCOUNT_LABEL: Record<Account, string> = { youtube: "YouTube", instagram: "Instagram" };

/** The account a post goes on (IN-FR-09). */
function accountFor(platform: InvitePost["platform"]): Account {
  return platform === "instagram_reel" ? "instagram" : "youtube";
}

/** What the invite page needs to know, worked out once from the API's data. */
export interface InviteView {
  /** Each post, with its example due date if the brand approved today (IN-FR-07); null without a deadline. */
  posts: (InvitePost & { label: string; exampleDate: string | null })[];
  /** The total as a two-place decimal string, only when every post has an amount (IN-FR-08). */
  total: string | null;
  /** The accounts this deal's posts need, in the order YouTube, Instagram (IN-FR-09). */
  accounts: { platform: Account; label: string; connectedAs: string | null }[];
  /** The first thing left before "Create link", and how many more; null when nothing is (IN-FR-16). */
  left: { first: string; more: number } | null;
  /** The "Before you send" list, in page order (IN-FR-16). */
  checks: { key: "posts" | Account | "paypal"; label: string; done: boolean }[];
  canCreate: boolean;
}

/**
 * The invite page's view model: which accounts are needed, and what is left
 * before the link can be created.
 *
 * @param invite - the deal's invite terms from the API
 * @param profile - the creator's profile (PayPal email, connected accounts)
 * @param today - the creator's today, for example dates
 * @see docs/specs/creator-invite-frd.md IN-FR-09, IN-FR-16, IN-BR-07
 */
export function inviteView(invite: DealInvite, profile: CreatorProfile, today: Date): InviteView {
  const needed = (["youtube", "instagram"] as const).filter((a) => invite.posts.some((p) => accountFor(p.platform) === a));
  const accounts = needed.map((platform) => ({
    platform,
    label: ACCOUNT_LABEL[platform],
    connectedAs: profile.accounts.find((a) => a.platform === platform)?.name ?? null,
  }));

  const checks: InviteView["checks"] = [
    { key: "posts", label: "Amounts and deadlines", done: invite.posts.every((p) => p.amount && p.deadlineDays) },
    ...accounts.map((a) => ({
      key: a.platform,
      label: a.connectedAs ? `${a.label} connected as ${a.connectedAs}` : `Connect ${a.label}`,
      done: !!a.connectedAs,
    })),
    { key: "paypal", label: "PayPal email", done: !!profile.paypalEmail },
  ];

  const todo: string[] = [];
  for (const post of invite.posts) {
    const label = PLATFORM_LABEL[post.platform];
    if (!post.amount) todo.push(`Add an amount for the ${label}`);
    if (!post.deadlineDays) todo.push(`Set a deadline for the ${label}`);
  }
  for (const account of accounts) if (!account.connectedAs) todo.push(`Connect ${account.label}`);
  if (!profile.paypalEmail) todo.push("Add your PayPal email");

  const posts = invite.posts.map((post) => ({
    ...post,
    label: PLATFORM_LABEL[post.platform],
    exampleDate: post.deadlineDays ? shortDate(addDays(today, post.deadlineDays)) : null,
  }));
  const amounts = invite.posts.map((p) => p.amount);
  const total = amounts.every((a): a is string => !!a) ? sumAmounts(amounts) : null;

  return {
    posts,
    total,
    accounts,
    checks,
    left: todo.length ? { first: todo[0], more: todo.length - 1 } : null,
    canCreate: todo.length === 0,
  };
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

/** "22 Oct", in the creator's own time zone. */
function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}
