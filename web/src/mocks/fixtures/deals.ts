import type { z } from "zod";
import type { dealsSchema } from "@/lib/api/schemas";

/** Synthetic deals for the creator Ada Okafor. All made up. Provisional shape (DC-FR-31, DC-FR-37). */
export const deals: z.infer<typeof dealsSchema> = [
  { id: "deal_glow", brandName: "Glow Theory", status: "Draft check", openDeliverableId: "del_glow_video" },
  { id: "deal_nb", brandName: "Northbound Coffee", status: "Brand review", openDeliverableId: "del_nb_short" },
  { id: "deal_kora", brandName: "Kora Audio", status: "Waiting for your draft", openDeliverableId: "del_kora_reel" },
];
