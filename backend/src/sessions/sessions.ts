/**
 * Signed-in browsers (deal set-up spec DS-FR-03, DS-FR-05, DS-BR-02). A session is a random token. The
 * browser holds the token in a cookie the page cannot read; the database holds only its hash, so a copy
 * of the database signs nobody in.
 */
import type { PrismaClient } from "../generated/prisma/client";

export interface SessionSettings {
  /** How long a creator's session lasts from its last use (DS-FR-03). */
  creatorDays: number;
}

export const defaultSessionSettings: SessionSettings = { creatorDays: 14 };

/** How stale `lastUsedAt` may get before it is written again, so a busy page does not write on every request. */
const TOUCH_AFTER_MS = 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

const hash = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");

export type Sessions = ReturnType<typeof createSessions>;

export function createSessions(deps: { prisma: PrismaClient; now: () => Date; settings?: SessionSettings }) {
  const { prisma, now } = deps;
  const settings = deps.settings ?? defaultSessionSettings;
  const expiry = (from: Date) => new Date(from.getTime() + settings.creatorDays * DAY_MS);

  return {
    /** Signs a creator in. Returns the token for the cookie; it is not kept anywhere else. */
    async start(creatorId: string): Promise<string> {
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
      const at = now();
      await prisma.session.create({
        data: { tokenHash: hash(token), creatorId, createdAt: at, lastUsedAt: at, expiresAt: expiry(at) },
      });
      return token;
    },

    /** Who a cookie's token signs in, if it is a live session. Using a session keeps it alive. */
    async find(token: string): Promise<{ creatorId: string } | undefined> {
      const session = await prisma.session.findUnique({ where: { tokenHash: hash(token) } });
      const at = now();
      if (!session || session.expiresAt <= at) return undefined;
      if (at.getTime() - session.lastUsedAt.getTime() >= TOUCH_AFTER_MS) {
        await prisma.session.update({ where: { id: session.id }, data: { lastUsedAt: at, expiresAt: expiry(at) } });
      }
      return { creatorId: session.creatorId };
    },

    /** Signs a browser out. The same token sent again signs nobody in (DS-FR-05). */
    async end(token: string): Promise<void> {
      await prisma.session.deleteMany({ where: { tokenHash: hash(token) } });
    },
  };
}
