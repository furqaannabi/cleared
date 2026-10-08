import type { z } from "zod";
import type { creatorProfileSchema, dealInviteSchema } from "@/lib/api/schemas";

/* Types for the invite step, derived from the provisional schemas (IN FRD). */
export type DealInvite = z.infer<typeof dealInviteSchema>;
export type InvitePost = DealInvite["posts"][number];
export type CreatorProfile = z.infer<typeof creatorProfileSchema>;
