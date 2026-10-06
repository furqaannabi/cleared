# cleared
Brand deals where the content and the payment clear together.

Cleared is where a creator and a brand run a sponsorship deal they have already agreed. Built for the PayPal AI Hackathon; PayPal sandbox only. See [docs/PRODUCT.md](docs/PRODUCT.md).

## Repository

A pnpm workspace ([decision](docs/decisions/2026-10-06-repo-layout-and-package-manager.md)).

| Path | What |
| --- | --- |
| `web/` | Next.js frontend (Vercel) |
| `backend/` | Lambdas and infrastructure (AWS) |
| `contract/` | API contract and generated types |
| `design/` | Design prototypes, never shipped |
| `docs/` | [Product](docs/PRODUCT.md), [specs](docs/specs/), [decisions](docs/decisions/) |
| `DESIGN.md` | Design system |
