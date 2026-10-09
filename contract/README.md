# Contract

The API contract between `web/` and `backend/`. Both files are generated; neither is edited by hand.

| File | What |
| --- | --- |
| `openapi.json` | The OpenAPI 3.1 document for every route the pages call, produced from the schemas the backend checks each request with |
| `api.d.ts` | TypeScript types produced from that document |

## Using the types

```ts
import type { components, paths } from "contract";

type BrandDeal = components["schemas"]["BrandDeal"];
type AgreeBody = paths["/brand/deals/{dealId}/agree"]["post"]["requestBody"]["content"]["application/json"];
```

## Changing it

Change the route or its schema in `backend/`, then run `pnpm contract` there and commit what it writes. A backend test fails while the files here do not match the code, so a route cannot change without its contract.

Not in the contract, because no page calls them: PayPal's webhook and Google's two callbacks.

How this was decided: [the API contract is generated from the backend's Zod schemas](../docs/decisions/2026-10-09-api-contract-generated-from-zod.md).
