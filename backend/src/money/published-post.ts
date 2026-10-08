/**
 * Whether a deliverable's approved post is published, and when (MP-FR-16). The money module asks this
 * when a go-ahead runs out and at the deadline. The live check answers it once it is built; tests supply
 * the answer. It is decided by fixed code, never by a model (MP-BR-01).
 */
import type { PrismaClient } from "../generated/prisma/client";
import { decodeState } from "./codec";

export interface PublishedPostPort {
  /** When the approved post was published, or null if it has not been. Throws if the platform cannot say. */
  publishedAt(deliverableId: string): Promise<Date | null>;
}

/**
 * The answer until the live check exists: a post is published once that has been reported to the money
 * module, and not before. It knows nothing the module has not been told, so it can never release or keep
 * a hold on a guess.
 */
export function recordedPosts(prisma: PrismaClient): PublishedPostPort {
  return {
    async publishedAt(deliverableId) {
      const row = await prisma.deliverableMoney.findUnique({ where: { deliverableId }, select: { state: true } });
      return row ? decodeState(row.state).publishedAt : null;
    },
  };
}
