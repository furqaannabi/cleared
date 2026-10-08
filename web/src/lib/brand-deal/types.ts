import type { z } from "zod";
import type { brandDealSchema, noteSchema } from "@/lib/api/schemas";

/* Types for confirm and hold, derived from the provisional schemas (CH FRD). */
export type BrandDeal = z.infer<typeof brandDealSchema>;
export type BrandPost = BrandDeal["posts"][number];
export type Hold = BrandPost["hold"];
export type Note = z.infer<typeof noteSchema>;
