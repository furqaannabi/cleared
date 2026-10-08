# Cleared

## Authority

**Human is architect. Agent is senior engineer.**

- **Spec-driven. No code without a signed spec.** Check `docs/specs/` before every task. Doc hierarchy: `docs/PRODUCT.md` (what Cleared is, how a deal runs, the rules, v1 limits) → `docs/specs/*-frd.md` (numbered FRs/BRs per surface; the human signs before build) → `DESIGN.md` (the recorded visual world) → `README.md` (repo map).
- `docs/PRODUCT.md` is signed off (6 October 2026). Its "Still open" list is undecided: never build against an open item as if it were settled.
- Every feature maps to an FR id. Know which one before writing code. Tests are named after the FR. Commits list the FRs they close.
- Before starting any feature: invoke the `grill-me` skill to stress-test requirements as developer questions, one at a time, with a recommended answer for each.
- Then invoke `to-prd` to turn the answers into (or update) the surface's FRD in `docs/specs/`, and stop for the human's sign-off. Update the Status table in `docs/specs/README.md`.
- **A spec is signed only when the human says "signed" or "approve the spec" after seeing it.** "Proceed", "continue", "go", or an answer to a question is not a signature. Before recording a signature, quote the spec's Status line back and wait for the yes. The agent never writes "Signed" on the human's behalf.
- **Exception:** design prototypes in `design/` are exempt from the spec and TDD rules (see `docs/decisions/2026-10-06-design-prototype-first.md`). They never ship and `web/` never imports from them.
- Before building anything visual: invoke `/impeccable` (vendored in `.claude/skills/impeccable`). Spec wins over taste. Mockups from the human override both. New surfaces inherit `DESIGN.md`; no new direction rolls.
- Before debugging: invoke the `diagnose` skill.
- Every feature is test-driven: write the failing test first, then the implementation. Invoke the `tdd` skill before any feature work. Components get tests too, not only pure functions.
- Never make architecture decisions autonomously. Present 2–3 options with trade-offs; the human chooses.
- **Ownership:** William leads the frontend (`web/`, UI, design system, frontend tests). Furqaan leads the backend (pipeline, PayPal, AWS, data, AI checks). Each makes the calls in their own area. The API contract, repo layout, shared types and product behaviour need both.
- When William or Furqaan makes an architecture or product decision, record it as a dated ADR in `docs/decisions/` (`YYYY-MM-DD-title.md`, format in that folder's README) and link it from the affected spec's Revision table. Never edit an existing record; write a new one that supersedes it.
- Never bulk-generate code. One page, one component, one route, one job handler at a time.
- **Before writing more than one document, show the human the list of files and what each will contain, and wait for a yes.** Scope is theirs to set; a broad request ("write the docs") is not consent for a specific list.
- **Every commit and every push needs its own explicit ask.** "Commit and push" once does not carry forward to later work.
- Remind the human to commit after each meaningful change.
- If stuck or ambiguous: ask. Never guess on product behaviour.
- Flag risks immediately and explicitly: security, money movement, AI misjudging a deliverable, AWS cost (video models especially), and platform API access (YouTube / Instagram scopes and app review), and anything that weakens meaningful use of PayPal, AI or the sponsor tools (AG Grid, APIMatic). Those decide whether the project is eligible.

---

## Project

Cleared is where a creator and a brand run a sponsorship deal they have **already agreed**. The brand's money is held in PayPal, AI checks the creator's video against the brief, and the money is released when the approved post is live.

Tagline: **Brand deals where the content and the payment clear together.**

The creator is the main user: they start each deal and invite the brand with a link, the way a freelancer sends an invoice. Aimed first at direct deals between small brands and mid-size creators, no agency. **Cleared is not a marketplace.**

Team: William (frontend lead) and Furqaan (backend lead).

Built for the PayPal AI Hackathon. **PayPal sandbox only; no real money moves.** The goal is a good product, not a rushed one. Submission is 12 November 2026; requirements and judging criteria are under "Hackathon constraints" in PRODUCT.md. Design is one of five equally weighted criteria, and the demo must be runnable, not a mockup.

### Key Docs

| Doc | Path | Purpose |
| --- | --- | --- |
| Product | `docs/PRODUCT.md` | Problem, users, deal flow, rules, what gets checked, platforms, v1 limits, stack, open questions. Source of truth |
| Specs | `docs/specs/` | FRDs per surface; status table in `docs/specs/README.md`. FR prefixes are set when the first FRD is written |
| Decisions | `docs/decisions/` | Dated ADRs (`YYYY-MM-DD-title.md`), never edited after the fact; specs carry no dates and end with a Revision table |
| Design system | `DESIGN.md` | Recorded visual world: tokens, type, components, motion. All surfaces inherit it |
| Repo map | `README.md` | Surfaces and paths |

`docs/specs/` and `DESIGN.md` do not exist yet. Create them only when the human asks.

---

## Tech Stack

Chosen in `docs/PRODUCT.md`:

| Job | Choice |
| --- | --- |
| Holding, capturing and paying out | PayPal Orders, Payments, Payouts and Webhooks (sandbox, US accounts) |
| Reading the brief, judging each item | Claude on Amazon Bedrock |
| What was said, on-screen text and logos, timestamped | Amazon Bedrock Data Automation |
| What is shown, such as the product in use | A video model on Amazon Bedrock: TwelveLabs Pegasus or Amazon Nova (open) |
| Frontend | Next.js on Vercel |
| API | Hono on Bun, in TypeScript, described with OpenAPI (see `docs/decisions/2026-10-07-backend-hono-bun-prisma-postgres.md`) |
| Pipeline and timers | A job queue kept in Postgres, run by the same backend service. No Lambda, Step Functions or EventBridge Scheduler |
| Data | PostgreSQL on Amazon RDS, through Prisma. No DynamoDB |
| Backend hosting | One container on Amazon ECS Fargate |
| Sign-in | Cognito, with Google and Instagram sign-in for connecting accounts |
| Files and secrets | S3, KMS |
| Evidence table and brand dashboard | AG Grid and AG Studio, on `md:` and up; cards on phones (see `docs/decisions/2026-10-06-evidence-view-ag-grid.md`) |
| PayPal coding help | APIMatic's Context Plugin for PayPal |
| Creator accounts | Google sign-in (read-only) for YouTube; Instagram sign-in (professional accounts only) |
| Styling, UI primitives, motion | Tailwind v4 (DESIGN.md tokens in `@theme`), Radix UI primitives wrapped in `src/components/ui/`, Motion (`motion/react`, via `LazyMotion`) (see `docs/decisions/2026-10-06-frontend-stack.md`) |
| Frontend tests | Vitest + React Testing Library for components; Playwright for E2E and 375px checks (see `docs/decisions/2026-10-06-frontend-stack.md`) |
| Linting | ESLint with `eslint-config-next` (core web vitals + TypeScript), as generated by `create-next-app`; no formatter (William, 6 Oct) |
| Package manager and repo layout | pnpm workspace with `web/`, `backend/`, `contract/` (see `docs/decisions/2026-10-06-repo-layout-and-package-manager.md`; Furqaan to review) |
| Brand access | The invite link is swapped for an HttpOnly session scoped to one deal; no brand account in v1; PayPal login guards the holds (see `docs/decisions/2026-10-08-brand-access-by-link-session.md`; Furqaan to review) |
| Schema validation | Zod, for every API response and request body (see `docs/decisions/2026-10-06-schema-validation-zod.md`) |
| Frontend mocks | MSW handlers over synthetic fixtures, dev only, shared by dev, Vitest and Playwright (see `docs/decisions/2026-10-06-frontend-mocks-msw.md`) |

Everything behind the frontend uses AWS or the hackathon's sponsor tools. PRODUCT.md lists the sponsor tools not used; do not add them.

**Not yet decided.** When one of these comes up, present 2–3 options, the human chooses, and it gets an ADR. Then fill it in here:

| Decision | Owner |
| --- | --- |
| Job queue library for the Postgres-backed queue | Furqaan |
| Infrastructure as code (CDK, Terraform, …) | Furqaan |
| Backend test tooling | Furqaan |
| API contract between `web/` and the backend (Furqaan has chosen OpenAPI as its format; William to agree) | Both |

---

## Repository Layout

Set in `docs/decisions/2026-10-06-repo-layout-and-package-manager.md` (Furqaan to review). pnpm workspace.

| Path | What | Lead |
| --- | --- | --- |
| `web/` | Next.js app, deployed on Vercel with `web/` as its root | William |
| `backend/` | The Hono service (API and jobs), Prisma schema and infrastructure; TypeScript on Bun, so it joins the workspace | Furqaan |
| `contract/` | The API contract and types generated from it; no backend logic | Both |
| `design/` | Design prototypes; never ship, never imported | William |
| `docs/` | PRODUCT.md, specs, decisions | Both |

`web/` never imports from `design/` or `backend/`. Until the contract exists, provisional mock shapes live in `web/`.

---

## Product Rules (locked)

From `docs/PRODUCT.md`. Do not re-open without explicit human instruction.

| Rule | Detail |
| --- | --- |
| Not a marketplace | Creator and brand agree the deal elsewhere; Cleared runs it |
| One deliverable = one post on one platform | Each has its own amount, deadline, checklist and hold |
| Checklist before money | Both sides agree the same checklist before any hold. The checklist is the only thing a deliverable is judged against |
| Every checklist item cites the brief | AI cites the brief line each item came from and asks about anything ambiguous |
| Silence clears a fully passing draft, and nothing else | Fail or unsure never clears on a timer: the creator fixes it or the brand accepts it |
| Review before publish | A published video cannot be edited, so objections happen while a fix is possible. After publish, payment follows the live check with no second wait |
| Objection stops the clock | Objecting to an item moves that deliverable to manual approval |
| No publish without a confirmed hold | The hold is re-confirmed with PayPal at step 6; if it fails, the creator is told not to publish |
| **The AI never moves money** | AI returns findings with evidence. Fixed code confirms the evidence exists, decides, and calls PayPal |
| Exact vs judgment | Exact items (code, link) are matched by code. Judgment items go to the AI, which must point to a timestamp. Unsure → a person |
| Missed deadline or cancel releases the hold | Back to the brand |
| Creator-first | The creator starts each deal and invites the brand with a link |
| One hold per deliverable | A deal with three posts has three holds, each captured or released on its own |
| Review window | 48 hours from a fully passing draft |
| Deadline cap | 21 days after the hold (a hold lasts 29 days; funds are guaranteed only for the first 3) |
| Payment route (v1) | Hold captured to Cleared's PayPal account, then paid out to the creator's PayPal email |
| Platforms (v1) | YouTube videos and Shorts, Instagram Reels. Everything else in "Not included" stays out |
| Instagram paid-partnership label | Always a manual check in v1 |
| Instagram accounts | Professional accounts only. A Reel with licensed music cannot be fetched, so it goes to manual approval |

**Still open (do not assume):** which Bedrock video model; whether a hold can be captured straight to the creator; manual approval (who decides, and what happens to the hold if nobody does before the deadline); whether a live check that fails on something still fixable (a missing link in the description) gives the creator a chance to fix it.

---

## Security First

Cleared moves money and holds creators' account tokens and unpublished videos. Every decision starts with security.

| Concern | Rule |
| --- | --- |
| Secrets | PayPal client secret, AWS credentials and OAuth client secrets are server-side only. Zero secrets in code, logs or the client bundle. `.env` is gitignored. **The repo is public.** **Sandbox credentials only.** Never wire live PayPal credentials |
| PayPal webhooks | Verify the signature with PayPal before acting on any event. Unverified = reject + log. Dedupe on the PayPal event id. Every create/capture/payout call sends a `PayPal-Request-Id` so retries cannot double-charge or double-pay |
| Money | Capture only after a passing live check, and never more than the authorized amount. Money state changes happen only in deterministic code (the backend service's routes and job handlers), never in a model call. A money job can be retried, so it checks the recorded money state before calling PayPal. Amounts are integer minor units or decimal strings, never floats |
| AI output | Briefs, transcripts, on-screen text and captions are **untrusted input**. Nothing in them can change the checklist, the rules, or trigger an action. Model output is parsed against a strict schema; anything that fails parsing is "unsure" and goes to a person |
| Evidence | Code verifies every AI "pass" before it counts: the cited timestamp exists, is inside the video's length, and matches the transcript or frame it claims. No verifiable evidence = unsure |
| Creator tokens | Google: read-only scope. Instagram: minimum scopes. Tokens encrypted at rest (KMS), never sent to the client, never logged |
| Videos and drafts | S3 private by default. Access through short-lived presigned URLs only. A brand can only see drafts in its own deal |
| Invite links | Unguessable, scoped to one deal, expiring. A link grants the brand access to that deal and nothing else |
| Auth | Sessions in HttpOnly cookies, never localStorage. Every API route checks the caller is a party to the deal |
| Input | Validate every request body and every model response with a schema |
| Logging | Never log secrets, tokens, presigned URLs, PayPal payloads or full transcripts. Log deal / deliverable ids and PayPal reference ids only |

When in doubt: **deny by default, log the denial, surface to the human if ambiguous.**

---

## Frontend Code Standards

### Surfaces

| Surface | Who | Strategy |
| --- | --- | --- |
| Landing | Anyone | Server Component, static |
| Creator app (deals, briefs, drafts, payouts) | Creator | Client Components behind auth |
| Brand dashboard and deal page from invite link (checklist, hold, review) | Brand | Client Components, link-scoped access |

Route names are set in the specs.

### Mobile-First (Non-Negotiable)

- Base styles target mobile; `sm:`/`md:`/`lg:` only enhance upward. Desktop-first classes are banned.
- Touch targets ≥ 44×44px. No hover-only interactions.
- The brand's deal page and the creator's draft results are designed at 390px first. Creators live on their phones.
- Tables become card stacks on mobile; never horizontal-scroll a data table. AG Grid (evidence table, brand dashboard) is used on `md:` and up; below that, the same data renders as cards.
- Modals are full-screen on mobile, centered on `md:` and up.
- Test every new component at 375px before committing.
- Default breakpoints; do not customise.

### The evidence view

- AG Grid on `md:` and up, cards below. Both renderings come from one data source, are both tested, and show the same thing for every item.
- Every checklist item shows: its status (pass / fail / unsure), the brief line it came from, and its evidence. Timestamps are clickable and seek the video.
- Unsure is shown as unsure, never rounded up to pass.
- Money status shows **held → captured → paid**, each with its PayPal reference.

### Copy

- Use the product's words exactly: deal, deliverable, checklist, hold, draft check, review window, live check, cleared.
- Plain language for both sides. No PayPal or AWS jargon in the UI.
- Every "not paid yet" state says why and what happens next. Silent "processing" is the problem Cleared exists to fix.

### Components

- `src/components/ui/`: primitives, no business logic.
- Feature folders per surface (e.g. `checklist/`, `evidence/`, `deal/`, `payout/`).
- No God components. Over ~200 lines, split.
- Every exported component and utility has a JSDoc block: what it renders, params, and which PRODUCT.md section or FR it maps to.

### API calls

- Never hardcode API paths in components. Use one typed client in `src/lib/api/`.
- The frontend runs ahead of the backend against mocks. Mock shapes follow the agreed API contract; until that exists, they follow PRODUCT.md's terms and are marked provisional.
- Never invent backend behaviour. If the frontend needs a field or endpoint the contract doesn't have, write it up for Furqaan instead of mocking it into existence.

### Motion

- Motion is material, not decoration. Respect `prefers-reduced-motion`.

---

## Test-Driven Development (Mandatory)

**No feature ships without tests.**

```
1. Write failing test (red)
2. Minimum code to pass (green)
3. Refactor, keep green
4. Repeat per behaviour
```

What must be covered (tooling is decided by ADR):

| Area | Must prove |
| --- | --- |
| Deal state machine | Every transition in "How a deal runs". Silence clears only a fully passing draft. Objection moves to manual approval. Missed deadline / cancel releases the hold. No capture without a passing live check. No publish go-ahead without a re-confirmed hold |
| PayPal | Authorize, re-confirm, capture, void, payout against sandbox. Idempotent retries. Webhook signature reject. Duplicate event ignored |
| Exact checks | Code, link and hashtag matching are deterministic. Known-good and known-bad fixtures |
| AI checks | A golden set of real sponsored clips with expected results per item. Schema-invalid output becomes unsure. A pass with an unverifiable timestamp is rejected |
| Brief → checklist | Every item cites a real brief line. Ambiguous lines produce a question, not a guess |
| Live check | YouTube: the unlisted draft switches to public and matches the record. Instagram: transcript and length match the draft. Mismatch or unavailable → manual approval |
| Frontend | Components (with mocked API) plus E2E for the full deal: brief → invite → hold → draft check → review → publish → live check → paid |

Coverage target: ≥ 70% on components and lib code. CI blocks merge on any failing test.

---

## Build Order

The human sets the order. Default reference is the deal flow in `docs/PRODUCT.md`. Build so that each step works end to end in the sandbox before the next. Nothing ships as "coming soon".

---

## Workflow Rules

1. **Read the doc first.** Every feature maps to a section of `docs/PRODUCT.md` and an FR. Know which.
2. **One feature at a time.** Don't bundle unrelated changes in one commit.
3. **Test-driven, always.** Failing test first.
4. **Options, not assumptions.** Unclear behaviour → 2–3 options, human decides.
5. **Small diffs.** Surgical edits. No refactor-while-fixing.
6. **Explain the why.** After each change, say what changed and why, not a diff summary.
7. **No "coming soon".** A page either exists at production quality or is behind a flag.
8. **Justify every dependency:** what it replaces, why it is needed, and its cost (bundle size or AWS spend).
9. **Work on `main`.** No feature branches. Commit to `main` only when asked; the human pushes.

---

## Domain Language (use exactly)

| Term | Meaning |
| --- | --- |
| **Creator** | Main user. Starts each deal, submits drafts, publishes, gets paid |
| **Brand** | Invited user. Opens a link, confirms the checklist, approves the hold, reviews the draft |
| **Deal** | One sponsorship between one creator and one brand |
| **Deliverable** | One post on one platform, with its own amount, deadline, checklist and hold |
| **Brief** | The brand's written requirements for the deal |
| **Checklist** | The brief turned into separate items that can each pass or fail |
| **Item** | One checklist entry. Kinds: said, shown as text, shown, timing, written, disclosure, publication |
| **Evidence** | What proves an item: a timestamped transcript line, on-screen text, a video moment, or the published post / platform record |
| **Hold** | A PayPal authorization: the brand's money is reserved but not yet taken |
| **Re-confirming the hold** | Asking PayPal, just before the creator publishes, to confirm the reserved funds are still there (PayPal: reauthorizing) |
| **Released** | A hold given back to the brand on a missed deadline or a cancelled deal |
| **Draft check** | AI checking the video file against the checklist before it is published |
| **Review window** | The time the brand has to approve or object to a passing draft |
| **Objection** | The brand flagging one specific item during the review window |
| **Manual approval** | Where a deliverable goes when something can't be decided automatically |
| **Live check** | Confirming through the platform's API that the approved post is published |
| **Capture** | Taking the held money |
| **Payout** | Sending captured money to the creator |
| **Cleared** | A deliverable that has passed its live check and been paid |

Never abbreviate these. Never invent synonyms.

---

## What the Agent Cannot Do

- Deploy anything (Vercel, AWS resources, PayPal app settings).
- Use or wire live PayPal credentials.
- Change the confirmed stack, or fill a "Not yet decided" item, without explicit human approval and an ADR.
- Make product decisions: scope, the open questions in PRODUCT.md, page priority, what gets cut. Those belong to William and Furqaan.
- Make or change backend decisions in a frontend session. If frontend work needs a backend change, write it up for Furqaan.
- Let any model output trigger a money movement directly.
- Modify hold / capture / payout / release logic without human sign-off.
- Add dependencies without justifying them.
- Commit or push without being asked, each time.
- Write a batch of documents without first showing the file list and getting a yes.
