# Creator brief → checklist: FRD

**Status:** Signed by William (revision 1.0).

**Surface:** Creator app. Step 1 of [How a deal runs](../PRODUCT.md#how-a-deal-runs): the creator starts a deal, names its posts, gives the brand's brief, and gets a checklist per post that cites the brief, with the AI's questions answered. Step 2 (amounts, deadlines, PayPal email, connecting accounts, inviting the brand) is the next surface.

**Scope of this build:** frontend only, against provisional mocks (see [Mocks and the provisional contract](#mocks-and-the-provisional-contract)). The AI that reads the brief runs on the backend (Claude on Amazon Bedrock); the frontend sends the brief and shows what comes back. Requirements tagged **Depends on backend** name their fallback.

## Problem Statement

A creator agrees a sponsorship by email or chat, and the brand sends a brief: a page of requirements, some exact ("say the code GLOW20"), some vague ("mention us early"). Nobody turns it into a list both sides can check, so the creator finds out what the brand really meant after the video is live, when it can no longer be changed and payment is on hold.

## Solution

A short "New deal" flow. The creator names the brand and the posts (deliverables), pastes the brief, and the AI turns it into checklist items for each post. Every item cites the brief line it came from and says how it will be checked. Where a line is ambiguous the AI asks instead of guessing, with concrete answers to pick from. The creator answers every question, edits, removes, moves or adds items, and marks the checklist ready. The brand reviews it on the next surface before any money is held.

## User Stories

1. As a creator, I want to start a new deal from the rail or the Deals sheet, so that I can set it up when the brand says yes.
2. As a creator, I want to name the brand and list each post with its platform, so that every post gets its own checklist.
3. As a creator, I want to paste the brief the brand sent, so that I don't retype requirements.
4. As a creator, I want to be told plainly if what I pasted is too short or too long, so that I can fix it before the AI reads it.
5. As a creator, I want to see the AI reading my brief line by line, so that the wait isn't a silent spinner.
6. As a creator, I want to leave while the AI reads and come back to the result, so that I'm not stuck on the page.
7. As a creator, I want every item to cite the brief line it came from, so that I can see why it's there.
8. As a creator, I want each item to say how it will be checked (exact match, AI with a timestamp, or at the live check), so that I know what to expect.
9. As a creator, I want items sorted by post, with lines that apply to every post on each, so that each post has the right checklist.
10. As a creator, I want the AI to ask about vague lines, with concrete answers to pick from, so that nothing is decided by a guess.
11. As a creator, I want to answer a question in my own words when none of the answers fit, so that the item says what we agreed.
12. As a creator, I want to leave a line out of the checklist on purpose, and see that it isn't checked, so that nothing disappears silently.
13. As a creator, I want to edit an item's wording, remove it, or move or copy it to another post, so that the checklist matches the deal.
14. As a creator, I want to add an item the brief doesn't mention, marked as added by me, so that the brand sees it clearly.
15. As a creator, I want to see which brief lines are not checked, so that I know the whole brief was considered.
16. As a creator, I want to be stopped from marking the checklist ready while a question is unanswered, so that nothing vague reaches the money stage.
17. As a creator, I want my deal saved as soon as I name the brand and posts, so that I never lose my work.
18. As a creator, I want to know what happens after the checklist is ready, so that I'm not left wondering.
19. As a creator, I want a plain message and Try again if the AI couldn't read the brief, so that I can carry on.
20. As a creator on a phone, I want the whole flow to work at 375 px with 44 px targets, so that I can set up a deal anywhere.
21. As a creator using a keyboard or screen reader, I want every control reachable and named, and questions announced, so that I can use the flow without a mouse.

## Functional requirements

### Starting a deal

| ID | Requirement |
| --- | --- |
| BC-FR-01 | **New deal.** A "New deal" button at the top of the rail (desktop) and in the Deals sheet (phones) opens `/deals/new`. |
| BC-FR-02 | **The deal and its posts.** `/deals/new` asks for the brand's name and one or more deliverables, each with a platform: YouTube video, YouTube Short or Instagram Reel (PRODUCT.md "Platforms"). Up to 10 deliverables. Each can be removed until the deal is created. |
| BC-FR-03 | **Saved at once.** "Continue" creates the deal through the API and opens `/deals/{id}/checklist`. From then on the deal is in the rail as "{brand} · Checklist", and `/deals/{id}` opens the checklist page while the deal is at this step. |

### The brief

| ID | Requirement |
| --- | --- |
| BC-FR-04 | **Paste the brief.** A large text area, "Paste the brief {brand} sent". "Make the checklist" sends it. |
| BC-FR-05 | **Limits.** Under 40 characters: "This looks too short to be a brief. Paste the whole thing." Over 20,000 characters: "Briefs can be up to 20,000 characters, about 8 pages." Both are said before sending, and the button stays available to try again. |
| BC-FR-06 | **Upload a file. Depends on backend.** A PDF or .docx upload needs the backend to store the file and extract its text. Fallback: the page offers pasting only and says nothing about files. |
| BC-FR-07 | **Reading.** After sending, the page shows "Reading your brief…" with the brief split into numbered lines, and marks each line as the AI reaches it; items appear under their lines as they arrive. **Depends on backend** for progress; fallback: the lines show with a single "Reading" state until the result arrives. The creator can leave; coming back shows the current state. |
| BC-FR-08 | **Couldn't read.** If the API reports the AI could not read the brief, the page says "We couldn't read this brief." with Try again, and keeps the pasted text. |

### The checklist

| ID | Requirement |
| --- | --- |
| BC-FR-09 | **One tab per deliverable.** Items are grouped by deliverable, one tab each, styled like the draft check's deliverable switcher, each with its item count. |
| BC-FR-10 | **Every item shows** its name, its kind (Said, Shown as text, Shown, Timing, Written, Disclosure, Publication; PRODUCT.md "What gets checked"), the brief line it cites (number and text), and how it will be checked: "Exact match" (codes and links), "AI, with a timestamp" (judgment items) or "At the live check" (written, disclosure, publication). |
| BC-FR-11 | **Sorted by post.** A line that names one post's platform goes to that deliverable only; any other line becomes an item on every deliverable. The API decides; the page shows the result. |
| BC-FR-12 | **The brief beside the checklist.** From `lg:` up the brief's numbered lines sit beside the items, and selecting an item highlights its line. On phones each item shows its line inline. Lines with no item show "Not checked". |
| BC-FR-13 | **Questions.** A line the AI found ambiguous shows its question in plain words beside the line ("Line 3 says 'mention us early'. How early?") with the AI's two or three suggested answers, "Something else" (a short text field, up to 200 characters) and "Leave it out". Answering creates the item that cites the line; "Leave it out" marks the line "Not checked". A question can be reopened until the checklist is ready. |
| BC-FR-14 | **Edit.** The creator can change an item's wording (its citation stays), remove it (its line then shows "Not checked" unless another item cites it), and move or copy it to another deliverable. |
| BC-FR-15 | **Add.** "Add an item" asks for the wording and the kind (the seven kinds in plain words) and adds it marked "Added by you, not in the brief". |
| BC-FR-16 | **Checklist ready.** "Checklist ready" is available once every question is answered or left out and every deliverable has at least one item. Until then it says what is left ("Answer 2 questions first"). Taking it saves the creator's agreement through the API. |
| BC-FR-17 | **After ready.** The page says "Your checklist is ready. Next you'll set the amount and deadline for each post and invite {brand}." The rail shows the deal at "Invite". The checklist stays visible, read-only, until the invite surface is built. |
| BC-FR-18 | **Saving.** Every answer and edit is saved through the API as it is made; a failed save says so beside the item with Try again, and is never shown as saved. |

### Responsive and accessibility

| ID | Requirement |
| --- | --- |
| BC-FR-19 | Mobile-first at 375 px: one column, tabs scroll sideways, the questions sit under their lines, every target is at least 44 px, no sideways page scroll. |
| BC-FR-20 | Every control is reachable by keyboard and named; questions are announced as they appear; the reading progress is announced politely; reduced motion is respected. |

## Business rules

| ID | Rule |
| --- | --- |
| BC-BR-01 | Every item either cites a brief line or is marked "Added by you, not in the brief". No other items exist (PRODUCT.md: every checklist item cites the brief). |
| BC-BR-02 | The checklist cannot be marked ready while any question is unanswered (PRODUCT.md: the AI asks about anything ambiguous; nothing is held until both sides accept the same checklist). |
| BC-BR-03 | The brief is untrusted text. It is shown as plain text only (no links or formatting), and nothing in it can change these rules or trigger an action. |
| BC-BR-04 | Every AI response is validated against a schema on the backend; anything malformed becomes a question, never an item. The frontend validates every API response with its own schema too. |
| BC-BR-05 | The brand sees the creator's answers, edits and added items when it reviews the checklist (next surface), and can change them there. |

## Implementation Decisions

- **Routes:** `/deals/new` (stage 1) and `/deals/{id}/checklist` (brief, reading, checklist), inside the app shell. `/deals/{id}` sends a deal at this step to its checklist page (DC-FR-37 is extended with the deal's step).
- **Modules:** a pure **checklist view model** (tabs and counts, lines with their items, unanswered questions, "not checked" lines, whether Ready is allowed and what is left) tested on its own; components per feature folder (`new-deal/`, `brief/`, `checklist-builder/`), each under ~200 lines.
- **Data:** Zod schemas for the provisional API; one typed client; MSW handlers with a synthetic Glow Theory brief whose reading is simulated (lines marked over a few seconds, two questions).
- **Visual:** inherits DESIGN.md (seals, chips, the brief line style, the switcher). `/impeccable` shapes the screens before build; William picks.

## Mocks and the provisional contract

```ts
interface DealDraft {
  id: string;
  brandName: string;
  step: "checklist" | "invite";
  deliverables: { id: string; platform: "youtube_video" | "youtube_short" | "instagram_reel" }[];
  brief?: { lines: { number: number; text: string }[] };
  reading: "idle" | "reading" | "done" | "failed";
  readUpTo?: number;                      // Requests for Furqaan: progress through the lines
  items: DraftItem[];
  questions: Question[];
  ready: boolean;
}
interface DraftItem {
  id: string;
  deliverableId: string;
  name: string;
  kind: "said" | "shown_as_text" | "shown" | "timing" | "written" | "disclosure" | "publication";
  briefLine?: number;                     // absent only when addedByCreator
  addedByCreator: boolean;
  checkedBy: "exact_match" | "ai_timestamp" | "at_live_check";
}
interface Question {
  id: string;
  briefLine: number;
  text: string;
  suggestions: string[];                  // 2 or 3
  answer?: { kind: "suggestion" | "own_words" | "left_out"; text?: string };
}
```

### Requests for Furqaan

| For | Needs |
| --- | --- |
| BC-FR-03 | `POST /deals` with brand name and deliverables; returns the deal draft |
| BC-FR-04, BC-FR-07 | `POST /deals/{id}/brief` with the text; reading runs as a job; `GET /deals/{id}` returns `reading`, `readUpTo`, items and questions as they land (polling or push) |
| BC-FR-06 | File upload (PDF, .docx) to S3 through a presigned URL, with text extraction |
| BC-FR-08 | `reading: "failed"` and a retry |
| BC-FR-11 | The AI assigns each item to deliverables by platform mentions; general lines go to all |
| BC-FR-13 | Questions with 2 or 3 suggested answers; `PUT /deals/{id}/questions/{qid}` with the answer, returning the new or updated item |
| BC-FR-14, BC-FR-15 | Item edit, remove, move/copy and add endpoints |
| BC-FR-16 | `POST /deals/{id}/checklist/ready`; the deal's `step` becomes `invite` |
| DC-FR-37 | Each deal summary carries its `step`, so `/deals/{id}` can open the right page |
| BC-BR-04 | Model output schema-validated; malformed output becomes a question |

## Testing Decisions

- Tests check what the creator sees and can do, named after the BC-FR they prove.
- **Checklist view model:** tab counts; lines with and without items; "Not checked" after leave-out or remove; Ready blocked by unanswered questions and empty deliverables, with the right "what is left" text; added items marked.
- **Components:** stage 1 validation; brief limits; reading state; each question answer path (suggestion, own words, leave out, reopen); edit, remove, move, copy, add; Ready and the after-ready message; a failed save shown beside its item.
- **End to end (Playwright, on MSW):** new deal → brief → reading → answer both questions → ready, at 375 px and 1280 px; the deal appears in the rail at "Checklist", then "Invite".

## Out of Scope

- Amounts, deadlines, the PayPal email, connecting YouTube or Instagram, and inviting the brand (the next surface).
- The brand's review of the checklist.
- Editing the brief after the checklist is made, and re-reading it.
- Templates, saved briefs, or reusing a checklist from another deal.

## Open items

- **Changing the brief after reading:** out of scope for now. If the creator needs it, a later revision decides whether re-reading replaces the AI's items and keeps the creator's.
- **File upload** waits on the backend (BC-FR-06).

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with William: one "New deal" flow for step 1 (posts, brief, checklist); paste now, upload depends on backend; visible reading; questions with suggested answers; per-deliverable tabs and editing; "Checklist ready" saves the creator's agreement | none |
| 1.0 | Signed by William | none |
