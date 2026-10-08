import type { z } from "zod";
import type { brandDeliverableSchema } from "@/lib/api/schemas";

/* Types for the brand's review, derived from the provisional schema (RW FRD). */
export type BrandDeliverable = z.infer<typeof brandDeliverableSchema>;
export type BrandReview = BrandDeliverable["review"];
export type BrandItem = NonNullable<BrandDeliverable["draft"]>["items"][number];
export type BrandItemStatus = BrandItem["status"];
