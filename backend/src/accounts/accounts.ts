/** Creators and what belongs to them: their profile and their connected accounts (deal set-up spec). */
import type { PrismaClient } from "../generated/prisma/client";
import { enqueue, type JobHandlers } from "../jobs/jobs";

/** What `GET /me` returns (DS-FR-08). The PayPal email is the creator's own; no brand route returns it (DS-BR-13). */
export interface Profile {
  name: string;
  email?: string;
  demo: boolean;
  welcomed: boolean;
  paypalEmail?: string;
  accounts: { platform: "youtube"; name: string }[];
}

export interface AccountSettings {
  /** How many demo accounts one address may make in an hour (DS-FR-07). */
  demoPerHour: number;
  /** How long a demo account lives before it is deleted (DS-FR-07). */
  demoDays: number;
  /** The made-up creator a demo account starts as, and the sandbox PayPal email its payouts go to. */
  demoName: string;
  demoChannel: string;
  demoPaypalEmail: string;
}

export const defaultAccountSettings: AccountSettings = {
  demoPerHour: 10,
  demoDays: 7,
  demoName: "Ada Okafor",
  demoChannel: "Ada Okafor",
  demoPaypalEmail: "cleared-demo-creator@example.com",
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type Accounts = ReturnType<typeof createAccounts>;

export function createAccounts(deps: {
  prisma: PrismaClient;
  now: () => Date;
  settings?: AccountSettings;
  /** Told once a creator's YouTube channel is stored, so that what was waiting on it can carry on (PT-FR-17). */
  onYouTubeConnected?: (creatorId: string) => Promise<void>;
}) {
  const { prisma, now } = deps;
  const settings = deps.settings ?? defaultAccountSettings;

  return {
    /**
     * Makes a fresh demo creator for one visitor (DS-FR-06): made-up, with a YouTube channel already
     * connected and a sandbox PayPal email. `madeFrom` identifies the visitor's address without keeping it.
     */
    async startDemo(madeFrom: string): Promise<{ creatorId: string } | "too_many"> {
      const at = now();
      const recent = await prisma.creator.count({
        where: { demo: true, madeFrom, createdAt: { gt: new Date(at.getTime() - HOUR_MS) } },
      });
      if (recent >= settings.demoPerHour) return "too_many";
      // The job that deletes it is written with it, so no demo account is left behind (MP-FR-42).
      return prisma.$transaction(async (tx) => {
        const creator = await tx.creator.create({
          data: {
          name: settings.demoName,
          demo: true,
          madeFrom,
          welcomedAt: at,
          paypalEmail: settings.demoPaypalEmail,
          createdAt: at,
          accounts: {
            create: {
              platform: "youtube",
              externalId: `demo-${crypto.randomUUID()}`,
              name: settings.demoChannel,
              synthetic: true,
              connectedAt: at,
            },
          },
        },
        });
        await enqueue(tx, {
          name: "demo_cleanup",
          payload: { creatorId: creator.id },
          runAt: new Date(at.getTime() + settings.demoDays * DAY_MS),
        });
        return { creatorId: creator.id };
      });
    },

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
      const account = { ...channel, synthetic: false, connectedAt: now() };
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

    /** The jobs this module schedules. */
    handlers: {
      /** Deletes a demo creator and everything that belongs to it (DS-FR-07). Never anyone else. */
      async demo_cleanup(payload) {
        const creatorId = (payload as { creatorId?: unknown } | null)?.creatorId;
        if (typeof creatorId !== "string") throw new Error("A demo cleanup job is missing its creatorId");
        await prisma.creator.deleteMany({ where: { id: creatorId, demo: true } });
      },
    } satisfies JobHandlers,

    async profile(creatorId: string): Promise<Profile | undefined> {
      const creator = await prisma.creator.findUnique({ where: { id: creatorId }, include: { accounts: true } });
      if (!creator) return undefined;
      return {
        name: creator.name,
        email: creator.email ?? undefined,
        demo: creator.demo,
        welcomed: creator.welcomedAt !== null,
        paypalEmail: creator.paypalEmail ?? undefined,
        accounts: creator.accounts
          .filter((account) => account.platform === "youtube")
          .map((account) => ({ platform: "youtube" as const, name: account.name })),
      };
    },
  };
}
