# Draft check and review: FRD

**Status:** Signed by Furqaan (revision 1.0). It accepts two of William's records as written (a fresh link per review, an objection settled by the two sides) and adds to what his draft check and brand review pages call; those additions are listed for him.

**Surface:** Backend. Steps 4 and 5 of [How a deal runs](../PRODUCT.md#how-a-deal-runs), as an API the pages William has built can call: the creator sends a draft of a held post, it is checked against the agreed checklist with evidence for every item, the creator can ask the brand to accept what the check could not decide, and a fully passing draft opens the brand's 48-hour review window, which ends in an approval, an objection or silence.

**Scope of this build:** the routes, the data behind them, the check itself (Amazon Bedrock Data Automation, Claude and Amazon Nova on Amazon Bedrock, and fixed code that matches exact items and verifies every pass), the review window's timer, and the one call into the [money path](money-path-frd.md) that says a draft is cleared to publish. It is built and tested locally: Postgres in Docker, a real S3 bucket, real Bedrock, and the PayPal sandbox. Deployment is a later spec. Steps 6 to 8 are out of scope, and so is everything under [Out of Scope](#out-of-scope).

## Problem Statement

A deal can now be agreed and held, and then it stops. The creator has nowhere to send the video, nothing checks it, and the brand has nothing to review. William's draft check and brand review pages are finished and show made-up results.

This step is also where Cleared's central promise is kept or broken. A creator needs to know, while a fix is still possible, whether the video meets what was agreed. A brand needs to see proof for each item, not a claim. And the money rule that silence clears a fully passing draft is only safe if "passing" means something a person could check: every pass has to point at a real moment in the video.

## Solution

The creator opens a held post and sends the video file. A few minutes later every checklist item that can be checked before publishing has a result: passed, fix needed or unsure, each with its evidence. A spoken code quotes the transcript at its second; an on-screen code quotes the text that was on screen; a product in use points at the moment it is visible. Items that can only be checked on the published post say so.

Fixed code decides as much as it can. Codes, links and hashtags are matched by code. For the rest the AI proposes and code verifies: a pass only counts if the moment it cites exists and holds what it claims. Anything that cannot be verified is unsure, and unsure is never rounded up.

The creator fixes what failed and sends a new draft, or asks the brand to accept an unsure item. When every item is passed or accepted, the brand has 48 hours: it can approve, object to specific items, or say nothing, and silence approves. An approved draft is cleared to publish. Nothing in this step moves money.

## User Stories

1. As a creator, I want to send my video for a held post, so that it is checked before I publish.
2. As a creator, I want to be told at once if my file is the wrong type, unreadable or too long, so that I do not wait for a check that cannot run.
3. As a creator, I want to see the check's progress stage by stage, so that I know it is working and roughly how far along it is.
4. As a creator, I want every item to show passed, fix needed or unsure, so that I know exactly what stands between me and being paid.
5. As a creator, I want each result to show its evidence with a timestamp, so that I can jump to the moment and see it for myself.
6. As a creator, I want a spoken code that was transcribed slightly wrong to come back unsure and not failed, so that I am not penalised for the machine's hearing.
7. As a creator, I want a short suggestion for each item that needs fixing, so that I know what to change.
8. As a creator, I want items that can only be checked on the published post to say so, so that I do not try to fix them in the draft.
9. As a creator, I want to send a new draft and see what changed since the last one, so that I know my fix worked and nothing else broke.
10. As a creator, I want to be told that a new draft cancels my open asks, the brand's acceptances and its objections, so that I am not surprised.
11. As a creator, I want a check that fails on Cleared's side to be retried without my doing anything, and to be told it is not my fault, so that I do not waste time sending the file again.
12. As a creator, I want a failed check not to use up one of my checks, so that Cleared's problems do not cost me.
13. As a creator, I want to ask the brand to accept an item the check could not decide, so that a correct video is not blocked by an uncertain machine.
14. As a creator, I want to withdraw an ask, so that I can fix the item instead.
15. As a creator, I want to see when the brand accepted an item or asked me to fix it, with its note, so that I know what to do next.
16. As a creator, I want to be told when my draft is fully passing and when the brand's review ends, so that I know when I can expect to be cleared.
17. As a creator, I want a link to send the brand for its review, so that it can open my draft without an account.
18. As a creator, I want to see whether the brand has opened my draft, so that I know to chase it.
19. As a creator, I want to see which items the brand objected to and why, so that I can fix exactly those.
20. As a creator, I want to be told plainly when my draft is approved and not to publish yet, so that I wait for the hold to be confirmed.
21. As a creator, I want my unpublished video to be visible only to me and, when it has something to do, to this deal's brand, so that it does not leak.
22. As a creator, I want my drafts deleted after the deal ends, so that Cleared does not keep my unpublished work.
23. As a brand, I want to open a review link and land on the post that needs me, so that I do not hunt for it.
24. As a brand, I want to watch the draft and see each item's result and evidence, so that I can judge it myself.
25. As a brand, I want to accept an item the check was unsure of, or ask for it to be fixed with a note, so that the creator knows where they stand.
26. As a brand, I want 48 hours from a fully passing draft to approve or object, so that I have a fair chance to look.
27. As a brand, I want to object to specific passed items, each with a note, so that I can say exactly what is wrong.
28. As a brand, I want my objection to stop the clock, so that the draft is not approved while it is disputed.
29. As a brand, I want to approve a draft myself, so that the creator need not wait the full 48 hours.
30. As a brand, I want to approve a draft I objected to if I change my mind, so that the deal can go on.
31. As a brand, I want to be told when I am too late to object, so that I understand why the draft is approved.
32. As a brand, I want never to see the creator's suggested fixes, earlier drafts or PayPal email, so that I see only what I am asked to review.
33. As a brand's colleague with the link, I want my own session, so that I can review from my own device.
34. As a demo visitor, I want to check a ready-made sample video with one press, so that I can see a draft check without filming anything.
35. As the team, I want every model's answer checked against a strict schema, so that a malformed answer becomes "unsure" and never a pass.
36. As the team, I want nothing said or shown in a video to be able to change the checklist or a result decided by code, so that a video cannot talk its way to a pass.
37. As the team, I want every AI pass verified by code before it counts, so that silence can only ever clear a draft whose passes are real.
38. As the team, I want limits on the length and number of drafts, so that a public demo cannot run up the AWS bill.
39. As the team, I want a refused draft to cost nothing and say which limit it met, so that limits are cheap and understandable.
40. As the team, I want the review window's timer written with the change that starts it, so that a restart cannot lose it.
41. As the team, I want a golden set of our own clips with expected results, so that a change to a prompt or a model can be measured.
42. As William, I want the real routes to follow the provisional paths and shapes in my specs, so that my pages change as little as possible.

## Functional requirements

### Sending a draft

| ID | Requirement |
| --- | --- |
| DR-FR-01 | **Who and when.** The deal's creator can send a draft for a post whose hold is in place. It is refused, with the reason, when the post is not held, is released or closed, already has an approved draft, or has a check running. |
| DR-FR-02 | **The upload.** The page sends the file to the API in one request, with its name. The API streams it to a private bucket and never holds the whole file in memory. A file over 1 GB is refused as it arrives, at the limit, and nothing of it is kept. |
| DR-FR-03 | **The file itself** is examined before anything is analysed, by reading it and not by trusting its name: it must be an MP4 or MOV the service can read, with a video track, and at most 15 minutes long. A file that fails is deleted and reported as a file failure: unreadable, wrong format, or too long (with its length and the cap). |
| DR-FR-04 | **A file failure is not a check.** It does not count against any limit, the run number does not change, and the previous run's results, asks and review window stand exactly as they were. |
| DR-FR-05 | **A new draft starts a new run** once its file has passed DR-FR-03. From that moment every open ask, every acceptance and every objection on the previous run is cancelled, an open review window ends, and its review link stops working. |

### Limits

| ID | Requirement |
| --- | --- |
| DR-FR-06 | **Per post.** A post can be checked 10 times. |
| DR-FR-07 | **Overall.** Across everyone, no more than 300 minutes of video are checked in a day. |
| DR-FR-08 | **Demo accounts.** A demo account can have 3 drafts checked in total, each at most 3 minutes long. |
| DR-FR-09 | **At a limit,** the draft is not checked and nothing is analysed. The answer says which limit was reached and, for the daily one, when it resets. A file refused for the daily limit or the demo length is deleted. Every number in DR-FR-02, DR-FR-03 and DR-FR-06 to DR-FR-08 is a setting. |

### The check

| ID | Requirement |
| --- | --- |
| DR-FR-10 | **A job.** A run is a job, written with the change that starts it. It reports its stages in order, each waiting, current or done: reading the video, checking what was said and written on screen, checking what is shown, confirming the evidence. |
| DR-FR-11 | **What is checked now.** Items of kind said, shown as text, shown and timing are checked at the draft check. Items of kind written, disclosure and publication are reported as "at live check" and are not touched by a run. |
| DR-FR-12 | **Speech and on-screen text.** Amazon Bedrock Data Automation returns what was said and what text was on screen, each with the time it starts and ends. Everything below works from these and from the video. |
| DR-FR-13 | **Exact items** (a said or shown-as-text item that carries a code, link or hashtag) are matched by code against the speech or the on-screen text, after normalising both: case, spaces and punctuation are ignored, and for speech, number words become digits ("glow twenty" is "GLOW20"). A match passes, with the moment it was found as evidence. |
| DR-FR-14 | **A near miss is unsure.** If no match is found but the speech or text holds something one character away from the normalised value, or its parts within five seconds of each other but not together, the item is unsure, with that moment as evidence. With nothing close, the item is fix needed. |
| DR-FR-15 | **Said items that need judgment** go to Claude with the timed speech. For each it returns passed, fix needed or unsure and, for a pass, the words it relies on and when they were said. |
| DR-FR-16 | **Shown-as-text items that need judgment** go to Claude with the timed on-screen text, in the same way. |
| DR-FR-17 | **Timing items.** Claude returns the limit it understood from the item's wording, and the start and end of the moment or segment it means, quoting the words there. Code does the comparison itself: at or before a limit, or at least a length. Claude never returns a result for a timing item. |
| DR-FR-18 | **Shown items** go to Amazon Nova with the video. For each it returns passed, fix needed or unsure and, for a pass, the start and end of the moment and a short description of what is visible. |
| DR-FR-19 | **The second look.** For every shown item Nova passed, code cuts still frames from the moment it cited and asks Claude one question about those frames alone: is this visible, yes, no or cannot tell. Claude is not told what Nova answered. |
| DR-FR-20 | **A model is confident or unsure.** The models are told to answer fix needed only when they are confident the thing is missing or wrong, and unsure otherwise. A fix needed item from a model carries the model's reason as its suggestion (DR-FR-24). |
| DR-FR-21 | **One result per item,** recorded with the run: its status, its evidence (a label, the quoted words or description, and the start and end in seconds), and how it was checked. Evidence belongs to its run; an earlier run's evidence is never returned. |
| DR-FR-22 | **A finished run** increases the post's run number by one. From the second run, each item also carries its status in the run before. |
| DR-FR-23 | **When a service fails** (an error, a timeout or a throttle from Data Automation, Claude or Nova), no part of the run is shown. The job tries again up to 3 times with growing waits. After that the post reports a check failure on Cleared's side, and the creator can start the same draft's check again. It does not count as one of the post's 10 checks. |
| DR-FR-24 | **Suggestions.** A fix needed or unsure item may carry one plain sentence of at most 280 characters saying what to change. Code writes it for exact items; the model writes it for the rest. One that is missing, too long or malformed is left out. It is guidance only and never affects a result. |

### The creator's post

| ID | Requirement |
| --- | --- |
| DR-FR-25 | **One post.** Returns the post as its creator sees it: its state (no draft, checking, results, fully passing, objected, approved, check failed, released), the deadline and the creator's timezone, every item with its result, the run number, the brief, the latest draft, the hold as the money path has it, and the PayPal email the payout goes to. |
| DR-FR-26 | **While checking,** the post carries when the check started and its stages. The page asks again to follow it; results appear together when the run finishes. |
| DR-FR-27 | **The draft's address.** The latest draft comes with an address that plays it for 15 minutes, and a route gives a fresh one. |
| DR-FR-28 | **The deals list** carries each post's real state, a one-line status, and which post's next step is the creator's. |
| DR-FR-29 | **A check failure** is reported as the file's (DR-FR-03) or Cleared's (DR-FR-23), with the file's name and whether a retry is under way. |

### Asking the brand

| ID | Requirement |
| --- | --- |
| DR-FR-30 | **Ask.** The creator can ask the brand to accept an unsure item of the latest finished run. The item becomes "waiting for brand". Any other status is refused, and so is an item the brand has already asked to be fixed in this run. |
| DR-FR-31 | **Withdraw.** A waiting item can be withdrawn, and returns to unsure. |
| DR-FR-32 | **Accept.** The brand can accept a waiting item. It becomes "accepted by brand" and counts as passed towards a fully passing draft. |
| DR-FR-33 | **Ask for a fix.** The brand can instead ask for a waiting item to be fixed, with an optional note of up to 500 characters. The item returns to unsure, marked as declined, with the note, and cannot be asked about again in this run. |
| DR-FR-34 | **No time limit.** A waiting item waits until the brand answers, the creator withdraws it, a new draft arrives or the hold is released. |

### The review window

| ID | Requirement |
| --- | --- |
| DR-FR-35 | **Fully passing.** A run is fully passing when it has finished and every item checked at the draft check is passed or accepted by the brand. This can happen when a run finishes, or later when the brand accepts the last waiting item. |
| DR-FR-36 | **The window opens** the moment a run becomes fully passing and lasts 48 hours. Its end is a job written in the same transaction. The post reports when it ends. |
| DR-FR-37 | **Approve.** The brand can approve the draft while the window is open, or after it has objected. The post becomes approved by the brand. |
| DR-FR-38 | **Object.** While the window is open the brand can send objections together, once per draft: each names an item that passed and carries a note of 1 to 500 characters. The window's timer stops and the post becomes objected. An accepted item and an at-live-check item cannot be objected to. |
| DR-FR-39 | **Too late.** An objection sent after the window has ended is refused with its own answer, distinct from every other refusal. |
| DR-FR-40 | **Silence.** When the window ends with no objection, on the same run, with the post still held, the post becomes approved by the window. |
| DR-FR-41 | **After an objection** the post waits on the two sides: a new draft from the creator, or the brand's approval. The money path's deadline still runs and releases the hold as from any other state. |
| DR-FR-42 | **Approved.** Approving records who approved and when, and tells the money path the draft is cleared to publish (MP-FR-10), in one transaction. From then no draft, ask, acceptance or objection is taken for the post. |
| DR-FR-43 | **Released.** A post whose hold the money path has released or closed is read-only: its last results stay, every action is refused, a window's job does nothing, and its review link stops working. |

### The brand's review

| ID | Requirement |
| --- | --- |
| DR-FR-44 | **A review link** is made for a post when the creator first asks about an item in a run, or when its window opens, whichever is first. It follows the invite link's rules (DS-FR-32, DS-BR-11): a token worked out again for its creator, only a hash stored. Swapping it gives the same deal-scoped session and also says which post to land on. |
| DR-FR-45 | **It stops working** when the brand has nothing left to do on that draft (the draft is approved, a new draft has started, or the hold is released) or after 7 days, whichever is first. The post carries the link for its creator while the brand has something to do. If it has expired and the brand still has something to do, the creator can make a new one. |
| DR-FR-46 | **Opened.** The first time a brand session reads a post's review, the time is recorded, and the creator's post reports it. |
| DR-FR-47 | **One post's review.** Returns the post as the brand sees it: both names, the hold and the deadline's date, where its review stands, and the latest draft with each item's status, its brief line and its evidence. It never carries a suggestion, an earlier run, the run number or the creator's PayPal email. |
| DR-FR-48 | **Only when asked.** The brand is shown a draft only from the first ask or the window's start of that run. Before that, and for a run that never reached either, the review says there is nothing yet and carries no draft. |
| DR-FR-49 | **The brand's deal** gains, for each post, where its review stands and how many items are waiting on it or objected. |

### Demo and test clips

| ID | Requirement |
| --- | --- |
| DR-FR-50 | **A sample.** A demo account can check a ready-made sample clip with one request, in place of an upload. It counts as one of its 3 drafts and runs the same check. |
| DR-FR-51 | **The golden set.** A development-only command runs the check on each of the team's recorded clips and compares every item's result with the one written down for it, reporting each difference, the time taken and what was used. It is run by hand, because every run costs money. |

## Business rules

| ID | Rule |
| --- | --- |
| DR-BR-01 | No model moves money or decides that a draft is cleared. A draft is cleared only by the brand approving it or by the window ending in silence, each in fixed code, which then calls the money path. |
| DR-BR-02 | Silence approves a fully passing draft and nothing else. The window's job acts only if the run is still the latest, every item is still passed or accepted, there is no objection and the post is still held. |
| DR-BR-03 | Unsure is unsure. No route, job or page rounds it up to passed. |
| DR-BR-04 | An exact item is decided by code alone. No model is asked about it. |
| DR-BR-05 | A pass for a said or shown-as-text item counts only if the words it quotes are found, after normalising, in the speech or on-screen text within two seconds of the time it cites, and that time is inside the video. Otherwise the item is unsure. |
| DR-BR-06 | A pass for a timing item counts only if the limit Claude understood appears as a number in the item's own wording, the quoted words are found as in DR-BR-05, and the comparison code makes holds. If the number is not in the wording, the item is unsure. If the sum does not hold, the item is fix needed. |
| DR-BR-07 | A pass for a shown item counts only if Nova's moment is inside the video and Claude, looking at frames from that moment, answers yes. A no or a cannot-tell makes the item unsure. |
| DR-BR-08 | Every model answer is checked against a strict schema. An item whose answer is missing, malformed, about an item it was not asked about, or outside the allowed values is unsure. A whole answer in the wrong shape is asked for once more; a second one makes every item it covered unsure. A model's refusal does the same. |
| DR-BR-09 | Speech, on-screen text, a model's description, a file's name, a note and an objection are untrusted. They are given to models as the material to examine, marked as such, never as instructions. Nothing in them can add, remove or reword a checklist item, change a result that code decides, or cause any action. |
| DR-BR-10 | The models have no tools. They return findings and nothing else. |
| DR-BR-11 | Every creator route checks the post belongs to a deal of that creator. Every brand route checks the session is for the deal and the post is in it. A post that is not the caller's and one that does not exist get the same answer. |
| DR-BR-12 | A draft is private. It is never public, and is reached only through an address that works for 15 minutes. The creator can play their own latest draft. The brand can play it only while it is shown that draft (DR-FR-48), and only in its own deal. |
| DR-BR-13 | The brand never sees a suggestion, an earlier run, the run number, the creator's PayPal email or their account details. |
| DR-BR-14 | A new draft cancels every ask, acceptance and objection of the run before it, and ends its window. |
| DR-BR-15 | One review per draft: objections are sent once. Afterwards the brand can only approve that draft. A new draft gets a new review. |
| DR-BR-16 | A check that fails, for the file's reasons or Cleared's, is not a run. A draft refused for a limit, or failing before analysis starts, counts against no limit. Minutes count towards the daily total from the moment analysis starts, whether or not the run then finishes. |
| DR-BR-17 | An upload is accepted only from Cleared's own app, with a creator session, and is cut off at the size limit as it arrives. |
| DR-BR-18 | Logs carry ids only: creator, deal, deliverable, run and item ids, and each service's own job ids, counts and timings. Never speech, on-screen text, evidence, a note, a file's name, a draft's address or a model's answer. |
| DR-BR-19 | When a newer draft's run finishes, the older draft's file and everything read from it are deleted. Everything kept for a post's drafts is deleted 30 days after the post is paid, released or closed. A demo account's drafts go when the account does. |
| DR-BR-20 | The evidence shown to the brand is the evidence the creator sees for the same run. Neither side is shown anything the other cannot check against the video. |

## Implementation Decisions

- **Storage is one private S3 bucket, and the file goes through the API** ([decision](../decisions/2026-10-09-drafts-uploaded-through-the-api-to-s3.md)). The upload route is the one changing route that does not take JSON: the file is the request's body. It still requires the app's origin and a creator session. Storage sits behind a port, so sending the file straight to S3 later would be one adapter.
- **Amazon Nova judges what is shown** ([decision](../decisions/2026-10-09-amazon-nova-judges-what-is-shown.md)). Claude Opus 5.5 judges speech and on-screen text, finds the moments for timing items, and takes the second look at frames. Both model ids and the region are settings.
- **How each pass is verified** is fixed by one record ([decision](../decisions/2026-10-09-how-an-ai-pass-is-verified.md)): the second look for shown items, the normalised match for codes, and code doing the sum for timing items.
- **A broken check fails the whole run** ([decision](../decisions/2026-10-09-a-broken-check-fails-the-run.md)). There are no partial runs.
- **Modules.** Each is a small interface with its tests:
  - **A storage port:** put a stream, give a short-lived address, delete, and delete everything under a prefix. The real one is S3; tests use a stand-in.
  - **A media port:** read a file's type and length, and cut still frames at given times. The real one runs ffprobe and ffmpeg; tests use a stand-in.
  - **A speech-and-text port:** given a stored video, return timed speech and timed on-screen text. The real one is Bedrock Data Automation, which answers later, so the job waits by scheduling itself again.
  - **A judge port:** three calls, each with a strict answer schema: judge said and shown-as-text items; find the moments for timing items; look at frames for one shown item. The real one is Claude on Bedrock.
  - **A video port:** judge shown items against a stored video. The real one is Amazon Nova on Bedrock.
  - **The exact matcher:** a pure function from an exact value and timed text to a match, a near miss or nothing.
  - **The verifier:** pure functions that take a model's claim and the timed speech, text or frames answer, and return the status that counts.
  - **The run's rules:** a pure function from a run's item statuses, asks and objections to the post's state and whether a window is open, tested on its own as the money path's transitions are.
  - **Drafts and runs:** accept a draft, apply the limits, start and follow the job, record results.
  - **Review:** asks, acceptances, the window and its job, objections and approval.
  - **Routes:** thin. Each checks the session, validates the body, calls a module and maps the answer.
- **The money module gains one thing:** a way to record that a draft is cleared inside the caller's transaction, as it gained one for agreeing (DS-FR-42), so DR-FR-42 is all or nothing. Nothing else in it changes.
- **Review links reuse the invite link's table and code,** with the post a link lands on. A session made from one is the same deal-scoped session.
- **Schema.** New tables for: drafts (the file, its length, its state); runs; item results with their evidence, asks and the brand's answers; objections; review windows; and the minutes checked (for the daily limit). Invite links gain the post they land on and when a review was first opened.
- **Paths** follow the provisional ones in William's specs (DC, RW) wherever they exist.
- **New libraries,** all AWS's own for services already in the stack: the S3 client with its streaming upload and its address signer, the Bedrock Data Automation client, and the Bedrock runtime client for Nova. Each replaces hand-written signed HTTP calls. The service also needs ffmpeg and ffprobe installed where it runs.
- **Settings,** each with the value in this spec as its default: the size and length caps, the three limits, the window's length, the retry count, the two-second and five-second tolerances, the address lifetime, the retention days, the two model ids, the bucket and the region.

### Requests for William

Decisions in this spec that change, or add to, what his signed specs and built pages do. Nothing in his specs is edited here.

| For | Needs |
| --- | --- |
| Draft check (DC-FR-45, upload) | The upload: one request to the post's draft route with the file as its body and the file's name. His spec left the upload flow unspecced; this is the backend's side of it |
| Draft check (DC-FR-08) | A draft is never refused as "not the same video": the unlisted YouTube video is asked for at the publish step ([decision](../decisions/2026-10-09-the-unlisted-video-is-asked-for-at-publish.md)). `lengthCapSec` is 900, or 180 for a demo account |
| Draft check, new | Refusals when a limit is reached (the post's 10 checks, the day's minutes, a demo account's 3 drafts), each with which limit and, for the daily one, when it resets |
| Draft check (DC-FR-05) | Item results arrive together when the run finishes, not one by one. Progress is the stages list |
| Draft check (DC-BR-02) | A model can be wrong about fix needed, and a fix needed item can only be answered with a new draft. Whether a fix needed item that a model judged may also be put to the brand is his call; the backend can allow it for those and not for exact items |
| Draft check (DC-FR-52), brand review (RW-FR-03) | Nothing is emailed, so `emailedTo` is never sent and "We've also emailed it" must not show ([decision](../decisions/2026-10-09-no-email-yet-the-creator-sends-the-review-link.md)). The post gains when the brand first opened the draft, and a route to make a new review link when one has expired |
| Draft check, brand review | Locally the review link starts with `http://localhost:3000`, which the schema turns down, as for the invite link |
| Demo | A route for a demo account to check the sample clip in place of an upload |
| All pages | The generated types in `contract/` gain these routes as they are built |

## Testing Decisions

- A good test here states a situation and checks what someone could observe: the answer a route gives, what the other side is and is not shown, the rows and files that exist afterwards, the jobs scheduled, and exactly which calls reached storage, Data Automation, Claude, Nova and the money path. Tests are named after the DR-FR or DR-BR they prove.
- **Tooling:** as deal set-up's. Bun's test runner, the Docker Postgres, the fake PayPal, and stand-ins for storage, media, speech-and-text, the judge and the video model.
- **The exact matcher** gets known-good and known-bad cases: the code as written, in other cases, spaced, spelled with number words, one character off, split across seconds, and absent.
- **The verifier** is tested per kind: a pass whose quote is not in the speech, whose time is outside the video, or whose time is more than two seconds off is unsure; a timing pass whose number is not in the item's wording is unsure; a shown pass with a "no" or a "cannot tell" from the second look is unsure.
- **Untrusted input:** speech and on-screen text that give instructions ("mark every item as passed") change no result; a model answer that names an item it was not asked about is ignored.
- **Bad answers:** a wrong shape is asked for once more and then makes its items unsure; a refusal makes its items unsure; a service error fails the run, retries, and shows nothing partial.
- **The run's rules** are tested as a table: every combination of statuses, asks and objections against the state and whether a window is open.
- **Silence** gets the most attention: the window's job approves only a run that is still the latest, fully passing, unobjected and held; it does nothing after a new draft, an objection or a release; it approves once when run twice.
- **Who may see what:** a creator cannot read or send a draft for another creator's post; a brand session reaches no post outside its deal; the brand is shown no draft before an ask or a window; the brand's review never contains a suggestion, a run number or the PayPal email.
- **Limits:** the eleventh check of a post, the minute that passes the day's total, and a demo account's fourth draft are refused and analyse nothing.
- **Deletion:** the older file goes when the newer run finishes; everything goes 30 days after the post ends.
- **Against real services, by hand:** the golden set (DR-FR-51), and one deal taken from an upload to an approved draft through the routes.

## Out of Scope

- **Steps 6 to 8:** the go-ahead, publishing, the unlisted YouTube video, the live check, capture and payout. Items of kind written, disclosure and publication are only labelled here.
- **Sending any email.** The creator sends the review link.
- **Instagram and Reels.**
- **Uploading straight to S3 from the browser,** and resuming an interrupted upload.
- **Showing earlier runs** or their evidence.
- **A person at Cleared deciding anything** in this step. Unsure goes to the brand.
- **Cancelling a post** from these pages (William's cancel spec).
- **Deployment,** infrastructure as code, and the bucket's creation by code.

## Open items

**Added while drafting and accepted by Furqaan at sign-off.** These were not asked in the question session; they are listed so the source of each is clear.

- **DR-FR-01:** a draft cannot be sent while a check is running, or once a draft is approved.
- **DR-FR-04, DR-FR-05:** a file that fails changes nothing; the previous run's asks and window end only when the new file has passed its checks.
- **DR-FR-14:** what counts as a near miss: one character away, or the parts within five seconds.
- **DR-FR-20:** a model answers fix needed only when confident. Risk: a wrong one leaves the creator no answer but a new draft; see Requests for William.
- **DR-FR-26:** results appear together at the end of a run, not item by item.
- **DR-FR-45:** the creator can make a new review link when one has expired while the brand still has something to do.
- **DR-BR-05:** the two-second tolerance between a cited time and where the words are found.
- **DR-BR-08:** a wrong-shaped answer is asked for once more, then its items are unsure.
- **DR-BR-16:** minutes count towards the daily limit once analysis starts, even if the run then fails, because AWS has charged for them by then.
- **The money module's one addition:** clearing a draft inside the caller's transaction.
- **Which Nova model:** Nova Pro to start with, compared with Nova 2 Lite on the golden set before the choice is fixed. The account can call both.

**To verify while building.**

- That Bedrock Data Automation returns speech and on-screen text with times precise enough for DR-BR-05, and how it writes a spoken code.
- What one minute of video really costs across the three services, and how long a run takes. The limits rest on an estimate of about 10 cents a minute.
- How well Nova's moments line up with the video on the golden set, and how often the second look disagrees with it.
- That a 1 GB upload through the API is workable from a home connection, and what happens when it drops.
- That Nova and Data Automation are callable from this AWS account with quota above zero, as Opus 5.5 at first was not.

**Needs setting up by a person.**

- An S3 bucket: private, public access blocked, encrypted, with a rule that deletes anything older than 90 days as a backstop. Its name goes in the service's settings.
- Permission for the AWS identity the service runs under to use that bucket, Data Automation and Nova.
- ffmpeg and ffprobe on the machine the service runs on.
- The recorded clips for the golden set, each with its expected result per item, and one chosen as the demo sample ([decision](../decisions/2026-10-09-test-clips-are-recorded-by-the-team.md)).

**Not solved here.** A demo account can only reach a draft check through a real sandbox hold, which needs a person to approve in PayPal's window. How a judge gets to this step without that is a product decision for both leads.

**Waiting on William.** The requests in the table above. His two records this spec accepts are now Furqaan's too: [a fresh link per review](../decisions/2026-10-08-fresh-brand-link-per-review.md) and [an objection settled by the two sides](../decisions/2026-10-08-objection-settled-by-the-two-sides.md).

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the question session with Furqaan: steps 4 and 5 together; the file uploaded through the API to a private S3 bucket; limits of 15 minutes, 1 GB, 10 checks per post, 300 minutes a day overall and 3 short drafts for a demo account; Amazon Nova for what is shown, chosen without a trial; every pass verified by code, a shown pass by a second look; spoken codes matched after normalising, a near miss unsure; timing items found by the AI and summed by code; a service failure fails the run; the unlisted video left to the publish step; no email, the creator sends the link; William's fresh link per review and his objection rule accepted; latest draft only, deleted 30 days after the deal ends; test clips recorded by the team | [Upload through the API](../decisions/2026-10-09-drafts-uploaded-through-the-api-to-s3.md), [Limits](../decisions/2026-10-09-limits-on-drafts.md), [Nova](../decisions/2026-10-09-amazon-nova-judges-what-is-shown.md), [Verifying a pass](../decisions/2026-10-09-how-an-ai-pass-is-verified.md), [A broken check](../decisions/2026-10-09-a-broken-check-fails-the-run.md), [No email yet](../decisions/2026-10-09-no-email-yet-the-creator-sends-the-review-link.md), [Unlisted video](../decisions/2026-10-09-the-unlisted-video-is-asked-for-at-publish.md), [Draft privacy](../decisions/2026-10-09-who-can-watch-a-draft-and-how-long-it-is-kept.md), [Test clips](../decisions/2026-10-09-test-clips-are-recorded-by-the-team.md) |
| 1.0 | Signed by Furqaan, with the eleven items added while drafting accepted as written | none |
