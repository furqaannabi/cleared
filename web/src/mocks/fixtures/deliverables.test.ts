import { expect, test } from "vitest";
import { dealsSchema, deliverableSchema } from "@/lib/api/schemas";
import { deals } from "./deals";
import { deliverables } from "./deliverables";

// Mocks must stay honest: every fixture is something the real client would accept.
test("every deliverable fixture passes the provisional schema", () => {
  for (const [id, fixture] of Object.entries(deliverables)) {
    expect(deliverableSchema.safeParse(fixture).success, id).toBe(true);
  }
});

test("the deals fixture passes its schema, and every deal opens a deliverable that exists", () => {
  expect(dealsSchema.safeParse(deals).success).toBe(true);
  for (const deal of deals) {
    expect(deliverables[deal.openDeliverableId], deal.id).toBeDefined();
    for (const d of deal.deliverables) {
      expect(deliverables[d.id], d.id).toBeDefined();
      expect(deliverables[d.id].state, d.id).toBe(d.state);
      expect(deliverables[d.id].platform, d.id).toBe(d.platform);
    }
  }
});
