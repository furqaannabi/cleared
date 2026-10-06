import { expect, test } from "vitest";
import { deliverableSchema } from "@/lib/api/schemas";
import { deliverables } from "./deliverables";

// Mocks must stay honest: every fixture is something the real client would accept.
test("every deliverable fixture passes the provisional schema", () => {
  for (const [id, fixture] of Object.entries(deliverables)) {
    expect(deliverableSchema.safeParse(fixture).success, id).toBe(true);
  }
});
