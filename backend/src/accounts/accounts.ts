/**
 * Creators and what belongs to them: their profile and their connected accounts (deal set-up spec).
 * Every creator signs in with Google: there are no demo accounts
 * (docs/decisions/2026-10-11-no-demo-accounts.md).
 */
import type { PrismaClient } from "../generated/prisma/client";

/** What `GET /me` returns (DS-FR-08). The PayPal email is the creator's own; no brand route returns it (DS-BR-13). */
export interface Profile {
  name: string;
  email?: string;
  welcomed: boolean;
  paypalEmail?: string;
  accounts: { platform: "youtube" | "instagram"; name: string }[];
}

export type Accounts = ReturnType<typeof createAccounts>;

export function createAccounts(deps: {
  prisma: PrismaClient;
  now: () => Date;
  /** Told once a creator's YouTube channel is stored, so that what was waiting on it can carry on (PT-FR-17). */
  onYouTubeConnected?: (creatorId: string) => Promise<void>;
}) {
  const { prisma, now } = deps;

  return {
    /**
     * Signs in a person Google has identified (DS-FR-02). An account not seen before becomes a new
     * creator; one seen before signs into the same creator.
     */
    async signInWithGoogle(google: { googleId: string; name: string; email: string }): Promise<{ creatorId: string }> {
      const creator = await prisma.creator.upsert({
        where: { googleId: google.googleId },
        create: { ...google, createdAt: now() },
        // Their Google name or email may have changed since they last signed in.
        update: { name: google.name, email: google.email },
      });
      return { creatorId: creator.id };
    },

    /**
     * Stores the YouTube channel a creator connected, replacing any they had (DS-FR-11). The refresh
     * token arrives already encrypted; this module never sees it in the clear.
     */
    async connectYouTube(
      creatorId: string,
      channel: { externalId: string; name: string; refreshTokenEncrypted: string },
    ): Promise<void> {
      const account = { ...channel, connectedAt: now() };
      await prisma.connectedAccount.upsert({
        where: { creatorId_platform: { creatorId, platform: "youtube" } },
        create: { creatorId, platform: "youtube", ...account },
        update: account,
      });
      await deps.onYouTubeConnected?.(creatorId);
    },

    /** Records that the creator has seen the welcome page (DS-FR-09). */
    async markWelcomed(creatorId: string): Promise<void> {
      await prisma.creator.updateMany({ where: { id: creatorId, welcomedAt: null }, data: { welcomedAt: now() } });
    },

    /** Saves the PayPal email the creator is paid at (DS-FR-10). */
    async setPaypalEmail(creatorId: string, paypalEmail: string): Promise<void> {
      await prisma.creator.update({ where: { id: creatorId }, data: { paypalEmail } });
    },

    async profile(creatorId: string): Promise<Profile | undefined> {
      const creator = await prisma.creator.findUnique({ where: { id: creatorId }, include: { accounts: true } });
      if (!creator) return undefined;
      return {
        name: creator.name,
        email: creator.email ?? undefined,
        welcomed: creator.welcomedAt !== null,
        paypalEmail: creator.paypalEmail ?? undefined,
        accounts: creator.accounts
          .filter((account) => account.platform === "youtube" || account.platform === "instagram")
          .map((account) => ({ platform: account.platform as "youtube" | "instagram", name: account.name })),
      };
    },
  };
}
