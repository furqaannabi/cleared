# Cleared

## Authority

**Human is architect. Agent is senior engineer.**

- **Spec-driven. No code without a signed spec.** Check `docs/specs/` before every task. Doc hierarchy: `docs/PRODUCT.md` (what Cleared is, how a deal runs, the rules, v1 limits) → `docs/specs/*-frd.md` (numbered FRs/BRs per surface; the human signs before build) → `DESIGN.md` (the recorded visual world) → `README.md` (repo map).
- `docs/PRODUCT.md` is itself still **Draft**. Treat its "Still open" list as undecided, and never build against an open item as if it were settled.
- Every feature maps to an FR id. Know which one before writing code. Tests are named after the FR. PRs list the FRs they close.
- Before starting any feature: invoke the `grill-me` skill to stress-test requirements as developer questions, one at a time, with a recommended answer for each.
- Then invoke `to-prd` to turn the answers into (or update) the surface's FRD in `docs/specs/`, and stop for the human's sign-off. Update the Status table in `docs/specs/README.md`.
- **A spec is signed only when the human says "signed" or "approve the spec" after seeing it.** "Proceed", "continue", "go", or an answer to a question is not a signature. Before recording a signature, quote the spec's Status line back and wait for the yes. The agent never writes "Signed" on the human's behalf.
- Before building anything visual: invoke `/impeccable` (install it into `.claude/skills/` first if it is missing). Spec wins over taste. Mockups from the human override both. New surfaces inherit `DESIGN.md`; no new direction rolls.
- Before debugging: invoke the `diagnose` skill.
- Every feature is test-driven: write the failing test first, then the implementation. Invoke the `tdd` skill before any feature work. Components get tests too, not only pure functions.
- Never make architecture decisions autonomously. Present 2–3 options with trade-offs; the human chooses.
- When William or Furqaan makes an architecture or product decision, record it as a dated ADR in `docs/decisions/` (`YYYY-MM-DD-title.md`, format in that folder's README) and link it from the affected spec's Revision table. Never edit an existing record; write a new one that supersedes it.
- Never bulk-generate code. One page, one component, one Lambda, one state-machine step at a time.
- **Before writing more than one document, show the human the list of files and what each will contain, and wait for a yes.** Scope is theirs to set; a broad request ("write the docs") is not consent for a specific list.
- **Every commit and every push needs its own explicit ask.** "Commit and push" once does not carry forward to later work.
- Remind the human to commit after each meaningful change.
- If stuck or ambiguous: ask. Never guess on product behaviour.
- Flag risks immediately and explicitly: security, money movement, AI misjudging a deliverable, AWS cost (video models especially), and platform API access (YouTube / Instagram scopes and app review).

---

## Project

Cleared is where a creator and a brand run a sponsorship deal they have **already agreed**. The brand's money is held in PayPal, AI checks the creator's video against the brief, and the money is released when the approved post is live.

Tagline: **Brand deals where the content and the payment clear together.**

The creator is the main user: they start each deal and invite the brand with a link, the way a freelancer sends an invoice. Aimed first at direct deals between small brands and mid-size creators, no agency. **Cleared is not a marketplace.**

Built for the PayPal AI Hackathon. **PayPal sandbox only; no real money moves.** The goal is a good product, not a rushed one.

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
| Holding, capturing and paying out | PayPal Orders, Payments, Payouts and Webhooks (sandbox) |
| Reading the brief, judging each item | Claude on Amazon Bedrock |
| What was said and shown on screen, with timestamps | Amazon Bedrock Data Automation |
| What is shown in the video | A video model on Amazon Bedrock (which one is open) |
| Pipeline and timers | AWS Step Functions, EventBridge Scheduler, Lambda |
| App | Next.js on AWS Amplify |
| Data and files | DynamoDB, S3 |
| Creator dashboard (deal / deliverable list) | AG Grid on `md:` and up. The evidence view is cards, not AG Grid (see `docs/decisions/2026-10-06-evidence-view-cards.md`) |
| Creator accounts | Google sign-in (read-only) for YouTube; Instagram sign-in (professional accounts only) |

**Not yet decided.** When one of these comes up, present 2–3 options, the human chooses, and it gets an ADR. Then fill it in here:

- Language for Lambdas and shared code
- Infrastructure as code (Amplify Gen 2, CDK, SAM, …)
- Package manager and monorepo layout
- UI kit, styling and motion libraries
- Test tooling
- How the brand is authenticated beyond the invite link

---

## Repository Layout

Not set yet. Decide it via ADR before the first code lands, then record it here and in `README.md`.

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
| Payment route (v1) | Hold captured to Cleared's PayPal account, then paid out to the creator |
| Platforms (v1) | YouTube videos and Shorts, Instagram Reels. Everything else in "Not included" stays out |
| Instagram paid-partnership label | Manual check in v1 |

**Still open (do not assume):** creator-first vs brand-first; the 48-hour review window; the 21-day deadline cap; which Bedrock video model; whether a hold can be captured straight to the creator.

---

## Security First

Cleared moves money and holds creators' account tokens and unpublished videos. Every decision starts with security.

| Concern | Rule |
| --- | --- |
| Secrets | PayPal client secret, AWS credentials and OAuth client secrets are server-side only. Zero secrets in code, logs or the client bundle. `.env` is gitignored. **Sandbox credentials only.** Never wire live PayPal credentials |
| PayPal webhooks | Verify the signature with PayPal before acting on any event. Unverified = reject + log. Dedupe on the PayPal event id. Every create/capture/payout call sends a `PayPal-Request-Id` so retries cannot double-charge or double-pay |
| Money | Capture only after a passing live check, and never more than the authorized amount. Money state changes happen only in deterministic code (Step Functions / Lambda), never in a model call. Amounts are integer minor units or decimal strings, never floats |
| AI output | Briefs, transcripts, on-screen text and captions are **untrusted input**. Nothing in them can change the checklist, the rules, or trigger an action. Model output is parsed against a strict schema; anything that fails parsing is "unsure" and goes to a person |
| Evidence | Code verifies every AI "pass" before it counts: the cited timestamp exists, is inside the video's length, and matches the transcript or frame it claims. No verifiable evidence = unsure |
| Creator tokens | Google: read-only scope. Instagram: minimum scopes. Tokens encrypted at rest, never sent to the client, never logged |
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
| Deal page from invite link (checklist, hold, review) | Brand | Client Components, link-scoped access |

Route names are set in the specs.

### Mobile-First (Non-Negotiable)

- Base styles target mobile; `sm:`/`md:`/`lg:` only enhance upward. Desktop-first classes are banned.
- Touch targets ≥ 44×44px. No hover-only interactions.
- The brand's deal page and the creator's draft results are designed at 390px first. Creators live on their phones.
- Tables become card stacks on mobile; never horizontal-scroll a data table. AG Grid is used only for the creator dashboard, and only on `md:` and up; below that, the same data renders as cards.
- Modals are full-screen on mobile, centered on `md:` and up.
- Test every new component at 375px before committing.
- Default breakpoints; do not customise.

### The evidence view

- Cards at every screen size. A deliverable's checklist is a short list, not a spreadsheet; no AG Grid here.
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

- Never hardcode API paths in components. Use one typed client in `src/lib/api/`; mock it in tests until the backend exists.

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
2. **One feature, one PR.** Don't bundle.
3. **Test-driven, always.** Failing test first.
4. **Options, not assumptions.** Unclear behaviour → 2–3 options, human decides.
5. **Small diffs.** Surgical edits. No refactor-while-fixing.
6. **Explain the why.** After each change, say what changed and why, not a diff summary.
7. **No "coming soon".** A page either exists at production quality or is behind a flag.
8. **Justify every dependency:** what it replaces, why it is needed, and its cost (bundle size or AWS spend).

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

- Deploy anything (Amplify, AWS resources, PayPal app settings).
- Use or wire live PayPal credentials.
- Change the confirmed stack, or fill a "Not yet decided" item, without explicit human approval and an ADR.
- Make product decisions: scope, the open questions in PRODUCT.md, page priority, what gets cut. Those belong to William and Furqaan.
- Let any model output trigger a money movement directly.
- Modify hold / capture / payout / release logic without human sign-off.
- Add dependencies without justifying them.
- Commit or push without being asked, each time.
- Write a batch of documents without first showing the file list and getting a yes.
