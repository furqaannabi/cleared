/**
 * The contract in `contract/` is generated, and must match the code (deal set-up spec DS-FR-47,
 * docs/decisions/2026-10-09-api-contract-generated-from-zod.md). If this fails, a route or a shape
 * changed: run `pnpm contract` in backend/ and commit what it writes.
 */
import { describe, expect, test } from "bun:test";
import { CONTRACT_FILES, contractDocument, contractTypes } from "./contract";

const inRepo = (path: string) => Bun.file(path).text();

describe("DS-FR-47 the contract", () => {
  test("the OpenAPI document in the repo is the one the routes produce", async () => {
    expect(await inRepo(CONTRACT_FILES.document)).toBe(contractDocument());
  });

  test("the TypeScript types in the repo are the ones that document produces", async () => {
    expect(await inRepo(CONTRACT_FILES.types)).toBe(await contractTypes(contractDocument()));
  });

  test("it covers what the pages call, and not what only PayPal calls", () => {
    const paths = Object.keys(JSON.parse(contractDocument()).paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        "/auth/demo",
        "/me",
        "/deals",
        "/deals/{dealId}/brief",
        "/deals/{dealId}/invite/link",
        "/b/{token}/session",
        "/brand/deals/{dealId}/agree",
        "/brand/deals/{dealId}/posts/{deliverableId}/hold/approved",
      ]),
    );
    expect(paths).not.toContain("/webhooks/paypal");
  });

  test("every error a route can answer with has the one error shape", () => {
    const document = JSON.parse(contractDocument()) as {
      paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { schema: unknown }> }> }>>;
    };
    const errors = Object.values(document.paths)
      .flatMap((methods) => Object.values(methods))
      .flatMap((route) => Object.entries(route.responses))
      .filter(([status, response]) => Number(status) >= 400 && response.content)
      .map(([, response]) => response.content!["application/json"]?.schema);

    expect(errors.length).toBeGreaterThan(50);
    expect(new Set(errors.map((schema) => JSON.stringify(schema)))).toEqual(new Set([JSON.stringify({ $ref: "#/components/schemas/Error" })]));
  });
});
