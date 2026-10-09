/**
 * The API contract (deal set-up spec DS-FR-47): one OpenAPI document produced from the same schemas
 * that check each request, and TypeScript types produced from that document. Both are written to
 * `contract/` at the top of the repo, where the frontend reads them. Nothing in `contract/` is written
 * by hand (docs/decisions/2026-10-09-api-contract-generated-from-zod.md).
 */
import { join } from "node:path";
import openapiTS, { astToString } from "openapi-typescript";
import { createApp } from "../app";
import { prisma } from "../db";

const CONTRACT_DIR = join(import.meta.dir, "..", "..", "..", "contract");

export const CONTRACT_FILES = {
  document: join(CONTRACT_DIR, "openapi.json"),
  types: join(CONTRACT_DIR, "api.d.ts"),
};

const HEADER = "// Generated from the backend's routes. Do not edit: run `pnpm contract` in backend/.\n\n";

/**
 * The OpenAPI document for every route the pages call, as the text of the file. It is built from the
 * app's routes alone and reaches neither the database nor any other service.
 */
export function contractDocument(): string {
  const document = createApp({ prisma }).getOpenAPI31Document({
    openapi: "3.1.0",
    info: {
      title: "Cleared API",
      version: "1.0.0",
      description:
        "Steps 1 to 3 of a deal: signing in, deals, brief to checklist, the invite and the brand's link, change requests, agreeing and the holds. " +
        "A creator's session and a brand's are HttpOnly cookies set by this API. " +
        "Every error has one shape: a code and, where useful, the field it is about.",
    },
  });
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** The TypeScript types for a document, as the text of the file. */
export async function contractTypes(document: string): Promise<string> {
  return HEADER + astToString(await openapiTS(JSON.parse(document)));
}

/** Writes both files. Run with `pnpm contract`. */
export async function writeContract(): Promise<void> {
  const document = contractDocument();
  await Bun.write(CONTRACT_FILES.document, document);
  await Bun.write(CONTRACT_FILES.types, await contractTypes(document));
}

if (import.meta.main) {
  await writeContract();
  await prisma.$disconnect();
  console.log(`Wrote ${CONTRACT_FILES.document} and ${CONTRACT_FILES.types}`);
}
