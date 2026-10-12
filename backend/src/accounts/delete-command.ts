/**
 * Deleting an account that was asked for by email (account and history spec AH-FR-22): what the
 * command does, apart from the terminal it is typed in. It finds the creator by the Google email
 * they sign in with, asks for that email to be typed again, and then runs the same deletion as the
 * route: refused for the same reasons, with what is in the way printed. It prints the account's id
 * and never its name (AH-BR-10).
 */
import type { PrismaClient } from "../generated/prisma/client";
import type { AccountRemoval, DealInTheWay } from "./removal";

export const USAGE = "Usage:\n  pnpm delete-account <the Google email the creator signs in with>";

const WHY: Record<DealInTheWay["why"], string> = {
  held: "a post is held",
  payout: "a payout is not settled",
  waiting_for_brand: "the brand has the terms, or may still hold",
};

/** A brand's name is the creator's own text. Printed to a terminal, it is plain text and nothing else. */
const plain = (text: string) => text.replace(/[^\P{C}]/gu, "").slice(0, 120);

export async function deleteByEmail(
  deps: {
    prisma: PrismaClient;
    removal: Pick<AccountRemoval, "deleteAccount">;
    /** Asks the person at the terminal a question, and answers with what they typed. */
    ask: (question: string) => Promise<string>;
    print: (line: string) => void;
  },
  args: string[],
): Promise<number> {
  const { prisma, removal, ask, print } = deps;
  const email = args[0]?.trim().toLowerCase();
  if (args.length !== 1 || !email || !/^[^@\s]+@[^@\s]+$/.test(email)) {
    print(USAGE);
    return 2;
  }

  const found = await prisma.creator.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (found.length !== 1) {
    print(found.length === 0 ? "No account signs in with that email. Nothing was deleted." : `${found.length} accounts sign in with that email, so none was chosen. Nothing was deleted.`);
    return 1;
  }
  const creatorId = found[0]!.id;

  print(`Account ${creatorId} signs in with that email. Deleting it cannot be undone.`);
  const typed = (await ask("Type the email again to delete it: ")).trim().toLowerCase();
  if (typed !== email) {
    print("That is not the same email. Nothing was deleted.");
    return 1;
  }

  const done = await removal.deleteAccount(creatorId);
  if ("refused" in done) {
    if (done.refused === "deal_open") {
      print("Not deleted. These are in the way, and must be finished or cancelled first:");
      for (const deal of done.blocking) print(`  ${plain(deal.brandName)}: ${WHY[deal.why]} (deal ${deal.dealId})`);
    }
    print("Nothing was deleted.");
    return 1;
  }
  print(`Deleted account ${creatorId}. Its files leave the bucket within the day, when the running service next works through its jobs.`);
  return 0;
}
