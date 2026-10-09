# Deal set-up: FRD

**Status:** Signed by Furqaan (revision 1.1). The decisions it shares with the frontend (no Cognito, the API on its own subdomain, the generated contract, no Instagram for now) are Furqaan's; William has to agree.

**Surface:** Backend. Steps 1 to 3 of [How a deal runs](../PRODUCT.md#how-a-deal-runs), as an API the pages William has built can call: a creator signs in, starts a deal, has its brief turned into a checklist, sets the terms and makes the brand's link; the brand opens the link, asks for changes or agrees, and approves a PayPal hold for each post.

**Scope of this build:** the routes, the data behind them, the sign-in, the reading of a brief with Claude on Amazon Bedrock, and the hold routes on top of the [money path](money-path-frd.md)'s module. It is built and tested locally: Postgres in Docker, real Bedrock, and the PayPal sandbox. Deployment is a later spec. Everything from the draft check onwards (steps 4 to 8) is out of scope, and so are the four things listed under [Out of scope](#out-of-scope) that each need outside set-up.

## Problem Statement

William's pages cover every step of a deal, and none of them can reach a real backend. A creator cannot sign in, a pasted brief is read by nothing, and the brand's link opens made-up data. The money path is built and tested, but only a script can drive it. Until the first three steps are real, nobody can run a deal from a brief to a hold, the project has no working use of AI, and the demo is a mock, which the hackathon does not accept.

## Solution

A creator signs in with Google, or tries a demo account with one press. They name the brand and the posts, paste the brief, and about half a minute later see a checklist: each item quotes the line of the brief it came from, and anything unclear comes back as a question with suggested answers. They fix what needs fixing, set an amount and a deadline for each post, and get a link for the brand.

The brand opens the link with no account. It sees the terms and every checklist item with its source, leaves notes on anything it disagrees with, and the creator answers with a new version. When the brand agrees to a version, a hold appears for each post, approved through PayPal. From that moment the deliverable's money is in the money path's hands.

Every route checks who is calling and that they are a party to the deal. The brief, the brand's notes and the model's answer are all treated as untrusted text.

## User Stories

**The creator**

1. As a creator, I want to sign in with my Google account, so that I have nothing new to remember.
2. As a creator, I want to stay signed in on my device, so that I can come back to a deal without signing in each time.
3. As a creator, I want to sign out and know it ended, so that a shared device is safe.
4. As a creator, I want to land back on the page I was going to after signing in, so that a link someone sent me still works.
5. As a creator, I want only my own deals to be visible to me, and mine to nobody else, so that my deals are private.
6. As a creator, I want to connect my YouTube channel with read-only access, so that Cleared can later confirm my post is on my channel without being able to change anything.
7. As a creator, I want to save the PayPal email I am paid at, so that payouts reach me.
8. As a creator, I want to start a deal by naming the brand and the posts, so that the deal exists before I paste anything.
9. As a creator, I want to paste the brief and get a checklist, so that I do not have to pull the requirements out by hand.
10. As a creator, I want every item to quote the line of the brief it came from, so that I can see nothing was invented.
11. As a creator, I want unclear lines to come back as questions with suggested answers, so that the AI never guesses for me.
12. As a creator, I want to answer in my own words or leave a line out, so that the suggestions do not box me in.
13. As a creator, I want to reword, remove, move, copy and add items, so that the checklist is right before the brand sees it.
14. As a creator, I want items I added to be marked as not from the brief, so that the brand can tell.
15. As a creator, I want to be told plainly when a brief could not be read, and to try again, so that I am not left on a spinner.
16. As a creator, I want to be told when I have reached a limit on reading briefs, so that I know it is not broken.
17. As a creator, I want to set each post's amount and its deadline in days after the hold, so that the terms are mine.
18. As a creator, I want an amount outside what one hold can be refused when I set it, so that I do not find out when the brand tries to pay.
19. As a creator, I want a link to send the brand, with the date it expires, so that I can share it however I like.
20. As a creator, I want to turn a link off or replace it, so that a link sent to the wrong person stops working.
21. As a creator, I want the brand's notes beside what they are about, and to reply, so that I can answer in place.
22. As a creator, I want to send updated terms to the same link, so that the brand does not need a new one.
23. As a creator, I want to see which posts are held, so that I know which I can start on.

**The brand**

24. As a brand, I want the link to open the deal with no account, so that I can review it like an invoice.
25. As a brand, I want the link to leave my address bar once the deal opens, so that it does not sit in my history.
26. As a brand, I want a link that no longer works to tell me only to ask for a new one, so that nothing about the deal leaks.
27. As a brand, I want to see the terms and every item with the line of my brief it came from, so that I know what I am agreeing to.
28. As a brand, I want to see which lines of my brief will not be checked and how unclear ones were read, so that nothing is dropped silently.
29. As a brand, I want to leave notes on items, amounts and deadlines and send them together, so that the creator gets one clear list.
30. As a brand, I want the new version to show what changed and how each note was answered, so that I only re-check what moved.
31. As a brand, I want to agree to one exact version, and to be stopped if it changed while I was reading, so that I never agree to terms I have not seen.
32. As a brand, I want to approve one hold per post through PayPal, so that a problem with one post does not block the others.
33. As a brand, I want never to see the creator's PayPal email, so that their details stay theirs.
34. As a brand's colleague with the link, I want my own session, so that I can approve the holds from my own device.

**A judge**

35. As a judge, I want to try a demo account with one press, so that I can use the product without connecting anything of my own.
36. As a judge, I want my own copy of the demo, so that another judge's actions do not change what I see.
37. As a judge, I want the demo to run a real brief and a real sandbox hold, so that I am judging the product and not a recording.

**Cleared (the team)**

38. As the team, I want every route to check the caller is a party to the deal, so that a guessed id shows nothing.
39. As the team, I want the brief and the model's answer treated as untrusted, so that nothing in a brief can change the rules or trigger an action.
40. As the team, I want every model answer checked against a schema and every citation checked against the brief, so that an invented item never reaches a checklist.
41. As the team, I want hard limits on how many briefs are read, so that a public demo cannot run up an unbounded bill.
42. As the team, I want no secret, token or email in a log or in the page's code, so that a public repo and public logs give nothing away.
43. As the team, I want the API described by a document generated from the code, so that the frontend and the backend cannot drift apart.
44. As the team, I want changing requests refused unless they come from our own app, so that another site cannot act as a signed-in user.

## Functional requirements

### Signing in

| ID | Requirement |
| --- | --- |
| DS-FR-01 | **Sign in with Google.** A route starts Google's sign-in and another receives its answer. The backend asks only for the person's identity (their Google id, name and email). The answer is accepted only if it matches the request that started it and Google's signature on it checks out. |
| DS-FR-02 | **First sign-in makes the creator.** A Google account not seen before becomes a new creator. One seen before signs into the same creator. |
| DS-FR-03 | **The session.** A successful sign-in sets a session cookie the page cannot read (HttpOnly, Secure, SameSite=Lax) and sends the browser back into the app. A creator session lasts 14 days from its last use. |
| DS-FR-04 | **Back where they were going.** The sign-in carries a `next` path. It is used only if it is a path on Cleared's own app; anything else is dropped and the creator lands on the default page. A first sign-in lands on the welcome page. |
| DS-FR-05 | **Sign out.** Ends the session on the backend and clears the cookie. The same cookie sent again is refused. |
| DS-FR-06 | **Try the demo account.** One route makes a fresh demo creator for this visitor, signed in at once, marked as a demo, with a made-up name, a YouTube channel already connected (made up, and marked so) and a sandbox PayPal email. It starts with no deals. |
| DS-FR-07 | **Demo limits.** At most 10 demo accounts an hour from one address. A demo creator and everything it made is deleted after 7 days, except a deliverable whose money is not finished, which is deleted once it is. |

### The creator's account

| ID | Requirement |
| --- | --- |
| DS-FR-08 | **Who is signed in.** `GET /me` returns the creator's name, email, whether this is a demo account, whether the welcome has been seen, the PayPal email, and each connected account's platform and name. With no session it answers 401. |
| DS-FR-09 | **Welcome seen.** A route records that the creator has seen the welcome page. |
| DS-FR-10 | **PayPal email.** The creator saves the PayPal email they are paid at. It must look like an email. It is not checked with PayPal. Changing it also changes where the payout goes for every deliverable of theirs that is not yet paid. |
| DS-FR-11 | **Connect YouTube.** A second trip through Google asks for read-only access to the creator's YouTube account. On return the backend reads the channel's id and name, stores them, and keeps Google's refresh token encrypted. The token is never sent to the page or logged. |
| DS-FR-12 | **Not connected.** If the Google account has no YouTube channel, or the creator declines the access, nothing is stored and the page is told which. |

### Deals

| ID | Requirement |
| --- | --- |
| DS-FR-13 | **Start a deal.** The creator gives the brand's name and one or more posts. Each post is a YouTube video or a YouTube Short. A deal with any other kind of post is refused with the reason. The deal starts at step `checklist`. |
| DS-FR-14 | **The deals list.** Returns the creator's own deals, each with its brand name, step, one-line status, and its posts. |
| DS-FR-15 | **One deal.** Returns the deal as its step needs it: the brief's numbered lines, the reading state, the items and questions, the terms, the notes, and each post's hold. |
| DS-FR-16 | **Change the brand or the posts.** Allowed only before the brief is sent or after it failed to read. Refused once reading has started. |

### Brief to checklist

| ID | Requirement |
| --- | --- |
| DS-FR-17 | **Send the brief.** The creator sends the brief as text, 40 to 20,000 characters. The backend splits it into numbered lines, stores them, and starts reading as a job. The deal's reading state becomes `reading`. |
| DS-FR-18 | **Reading.** Claude reads the numbered lines and returns, for the deal's posts, checklist items and questions. The job checks the answer (DS-BR-05 to DS-BR-07) and saves the items and questions together. The reading state becomes `done`. Items arrive all at once, not one by one. |
| DS-FR-19 | **An item.** Has a name, a kind (said, shown as text, shown, timing, written, disclosure, publication), the line it cites, the post or posts it applies to, and how it will be checked. A line that names one platform goes to those posts only; any other line applies to every post. |
| DS-FR-20 | **How an item is checked** is decided by code from its kind and whether it carries an exact value (a code, a link, a hashtag): exact match, AI with a timestamp, from timestamps, the published post, or the platform's record. |
| DS-FR-21 | **A question.** A line the model finds ambiguous comes back as a question in plain words with two or three suggested answers. Each suggested answer carries the item it would make. |
| DS-FR-22 | **Could not read.** If the model refuses, runs out of room, answers in a shape that fails the schema twice, or cannot be reached, the reading state becomes `failed`. The brief is kept. The creator can try again, which counts as a new read. |
| DS-FR-23 | **Answer a question.** The creator picks a suggested answer, writes their own (up to 200 characters), or leaves the line out. A suggested answer adds its item. Their own words become the item's name, citing that line and marked as the creator's reading of it. Left out adds nothing and records the line as left out. |
| DS-FR-24 | **Edit the checklist.** The creator can reword an item (its citation stays), remove it, move or copy it to another post, and add one of their own with a kind. An added item is marked "added by the creator, not in the brief". |
| DS-FR-25 | **Checklist ready.** Allowed once every question is answered or left out and every post has at least one item. The step becomes `invite`. It can be reopened from the invite step until a link exists, keeping the terms already entered. |

### Limits on reading

| ID | Requirement |
| --- | --- |
| DS-FR-26 | **Per account.** A demo account can have 5 briefs read in total. Any other creator can have 20 read in a day. |
| DS-FR-27 | **Overall.** Across everyone, no more than 300 briefs are read in a day. |
| DS-FR-28 | **At a limit,** the brief is not read and nothing is charged. The answer says which limit was reached and, for a daily one, when it resets. All four numbers in DS-FR-17, 26 and 27 are settings. |

### The invite

| ID | Requirement |
| --- | --- |
| DS-FR-29 | **Terms.** For each post the creator sets an amount in US dollars, as a decimal string with two places, and a deadline of 1 to 21 days after the hold. An amount outside the money path's limits ($20.00 to $10,000.00) is refused when it is saved, with the reason (MP-FR-09). |
| DS-FR-30 | **The brand's email** is optional and stored if it looks like an email. Nothing is sent to it. |
| DS-FR-31 | **Create the link.** Allowed when every post has a valid amount and deadline, the creator's YouTube channel is connected, and their PayPal email is saved. It saves the terms and the checklist as version 1, makes an unguessable link scoped to this deal that expires in 7 days, records the creator's timezone, and moves the deal to `waiting_for_brand`. |
| DS-FR-32 | **The link is returned to its creator only.** The backend keeps a hash of the link's token and a random salt, never the token or the link. Each time the creator's page fetches the link, the token is worked out again from the salt and a key the service holds ([decision](../decisions/2026-10-09-an-invite-link-is-worked-out-again.md)). The page can fetch it until it is turned off; one past its 7 days comes back marked as expired. |
| DS-FR-33 | **Replace or turn off.** "Make a new link" turns the old one off and returns a new one. "Change terms" turns the link off and moves the deal back to `invite`. A link turned off ends every brand session made from it. |

### The brand's way in

| ID | Requirement |
| --- | --- |
| DS-FR-34 | **Swap the link for a session.** The brand's page sends the link's token once. A live token returns a session cookie scoped to that one deal, and the deal's id. The session lasts until the link's expiry. Several people can each swap the same link. |
| DS-FR-35 | **A link that does not work.** An expired, turned-off and unknown token all get the same answer, which names no one and gives no reason. |
| DS-FR-36 | **The brand's deal.** Returns the creator's and brand's names, the terms, every item with its source (a brief line, added by the creator, or the creator's reading of an unclear line), the brief lines no item cites, the notes, the version, and each post's hold. It never includes the creator's PayPal email or account details. |
| DS-FR-37 | **No session.** A brand route called without a session for that deal answers "not signed in", and says nothing about whether the deal exists. |

### Change requests and versions

| ID | Requirement |
| --- | --- |
| DS-FR-38 | **Notes.** Until it agrees, the brand can send a set of notes together: each about an item, a brief line left out, a post's amount or deadline, or the deal as a whole. Each is plain text up to 500 characters. Sending them moves the deal to `changes_requested`. |
| DS-FR-39 | **The creator answers.** At `changes_requested` the terms and the checklist can be edited again and the link stays on. The creator can reply to each note (plain text, up to 500 characters). |
| DS-FR-40 | **Send updated terms.** Saves a new version, moves the deal back to `waiting_for_brand`, and restarts the link's 7 days. The brand's deal then shows the new version, what changed since the last one per item, amount and deadline, and each note with its reply. |

### Agreeing

| ID | Requirement |
| --- | --- |
| DS-FR-41 | **Agree to a version.** The brand agrees by naming the version it was shown. If that is not the latest, the agreement is refused as out of date and nothing changes. |
| DS-FR-42 | **Agreed.** Agreeing records the version and the time, moves the deal to `agreed`, and opens each post's money in the money path with its amount, deadline in days, the creator's timezone and PayPal email, all in one transaction. From then the terms and the checklist cannot be changed, and no more notes are accepted. |

### Holds

| ID | Requirement |
| --- | --- |
| DS-FR-43 | **Start a hold.** For one post of an agreed deal, the route starts a hold in the money path (MP-FR-01) and returns the PayPal order id for the page's PayPal button. The money path's refusals are passed on with their reasons (MP-FR-02). |
| DS-FR-44 | **Approved or closed.** The page reports that PayPal approved the order, or that the brand closed PayPal. The route passes it to the money path (MP-FR-03, MP-FR-05) and answers with the deal and that post's hold as it now stands: held with its PayPal reference and deadline date, declined, pending, unknown or closed. |
| DS-FR-45 | **What the page needs to show PayPal's button:** the brand's deal carries the sandbox app's public client id. Nothing secret is sent. |
| DS-FR-46 | **The creator's side.** The creator's deal shows each post's hold the same way. Once every post is held, the deal has left set-up and its summary says which post is next. |

### The contract

| ID | Requirement |
| --- | --- |
| DS-FR-47 | **One document.** Every route declares what it accepts and returns as a schema. The same schemas check each request when it arrives and produce an OpenAPI document, which is written to `contract/` with TypeScript types generated from it. A test fails if the document in the repo is out of date. |
| DS-FR-48 | **Errors** share one shape: a code and, where useful, a field. The codes are the refusal reasons in this spec and the money path's. No error carries a stack trace or anything from another deal. |

## Business rules

| ID | Rule |
| --- | --- |
| DS-BR-01 | Every creator route requires a creator session and checks the deal belongs to that creator. Every brand route requires a session for that deal. A deal that is not the caller's and a deal that does not exist get the same answer. |
| DS-BR-02 | A session is a random token. The backend stores only its hash. It is sent only in an HttpOnly, Secure cookie, never in a URL or a response body, and is never logged. |
| DS-BR-03 | A request that changes anything is refused unless it comes from Cleared's own app: its `Origin` must be the app's address and its body must be JSON. This is on top of the SameSite cookie. |
| DS-BR-04 | A brief, a note, a reply and an item's wording are untrusted plain text. They are stored and returned as text, never treated as markup or instructions, and nothing in them can change a rule or trigger an action. |
| DS-BR-05 | The model's answer is checked against a strict schema. An answer that fails is asked for once more; a second failure makes the read fail (DS-FR-22). Nothing from a failed answer is saved. |
| DS-BR-06 | Every item the model returns must cite a line number that exists in the brief. An item that cites no line, or a line that is not there, is dropped and that line is left as "not checked". No item from the model exists without a citation. |
| DS-BR-07 | The model never decides how an item is checked, never sets an amount, a deadline or a step, and has no tools. It returns items and questions and nothing else. |
| DS-BR-08 | The checklist cannot be marked ready while any question is unanswered. |
| DS-BR-09 | The brand never edits the terms. It asks; the creator changes them ([decision](../decisions/2026-10-08-brand-asks-for-changes-not-edits.md)). |
| DS-BR-10 | An agreement is to one version. A version the brand was not shown cannot be agreed to. No hold can be started before an agreement. |
| DS-BR-11 | The link's token is unguessable (at least 128 bits of randomness), scoped to one deal, and expiring. Only its hash and the salt it is worked out from are stored; the key is not in the database. It is never logged and never returned to anyone but the deal's creator. |
| DS-BR-12 | Amounts are stored as whole cents and exchanged as decimal strings. No amount is ever a floating-point number. |
| DS-BR-13 | The creator's PayPal email appears in nothing a brand can read. Google's tokens appear in nothing anyone can read. |
| DS-BR-14 | Google's refresh token is encrypted before it is stored, with a key the database does not hold. Read-only access is the only access ever asked for. |
| DS-BR-15 | Logs carry ids only: creator, deal, deliverable, session and request ids. Never a brief, a note, an email, a token, a link or a model's answer. |
| DS-BR-16 | A read that is refused for a limit, or that fails before the model is called, does not count against any limit. A read that fails after the model was called does. |
| DS-BR-17 | A demo account runs the same code as any other. Its data is made up, its money is the PayPal sandbox, and it is labelled as a demo in `GET /me`. |

## Implementation Decisions

- **Sign-in runs on the backend, against Google directly** ([decision](../decisions/2026-10-09-creators-sign-in-with-google-directly.md)). It uses Google's standard sign-in for web servers with a one-time code, a `state` value bound to a short-lived cookie, and a proof key. Google's signed identity token is verified against Google's published keys. There is no Cognito.
- **One Google client, two requests.** Signing in asks for identity only. Connecting YouTube is a separate request that adds read-only YouTube access and asks for a refresh token.
- **The app and the API are on one domain, as two subdomains** ([decision](../decisions/2026-10-09-app-and-api-on-one-domain.md)). The API allows credentialed requests from the app's address only. Both addresses are settings; locally they are two ports on `localhost`.
- **Modules.** Each is a small interface with its tests:
  - **Sessions:** make, look up by cookie, end, and end all for a link. One table serves both kinds: a creator's, and a brand's scoped to a deal.
  - **A Google port:** the sign-in address, exchanging a code, verifying an identity token, reading a channel. Tests use a fake.
  - **A secrets port:** encrypt and decrypt a token. KMS in production; a key from the environment in development and tests.
  - **A link keys port:** work out a link's token from its salt (DS-FR-32). KMS in production; a key derived from the same environment key in development and tests.
  - **A brief reader:** given numbered lines and the posts, returns checked items and questions, or a failure with its reason. It owns the prompt, the schema and the checks in DS-BR-05 to DS-BR-07. Tests use a fake model.
  - **A model port:** one call that sends instructions and numbered lines and returns a structured answer. The real one calls Claude on Bedrock; tests use a fake that can refuse, return a bad shape, or cite a line that is not there.
  - **Deals:** the steps and what each allows, as a pure function tested on its own, in the way the money path's transitions are.
  - **Terms versions:** take a snapshot, and say what changed between two.
  - **Read limits:** count reads per account and overall, and answer whether one more is allowed.
  - **Routes:** thin. Each checks the session, validates the body, calls a module and maps the answer.
- **The model** is Claude Opus 5.5 on Amazon Bedrock ([decision](../decisions/2026-10-09-briefs-read-by-claude-opus-on-bedrock.md)), called through Anthropic's Bedrock SDK. The model id and the AWS region are settings.
  - The instructions are fixed text in the system prompt and are cached. The brief goes in the user turn as numbered lines, marked as the brand's text and not as instructions.
  - The answer is constrained to a schema by the API and validated again by the backend.
  - The answer is streamed to the backend and read whole when it finishes. Nothing is shown from a partial answer.
  - A refusal, or an answer cut off for length, is a failed read.
- **Schema.** New tables for: creators; sessions; connected accounts; deals; deliverables; briefs and their lines; checklist items; questions; terms versions; notes; invite links; and brief reads (for the limits). A deliverable's id is the id the money path's row uses.
- **The money module gains one thing:** a way to open a deliverable's money and record the brand's agreement inside the caller's transaction, so DS-FR-42 is all or nothing. Nothing else in it changes.
- **Paths** follow the provisional ones in William's specs (BC, IN, CH, SI) wherever they exist, so his pages change as little as possible. The sign-in routes are `/auth/google`, `/auth/google/callback`, `/auth/demo` and `/auth/sign-out`; connecting YouTube is `/connect/youtube` and its callback.
- **The contract** is generated with Hono's OpenAPI add-on from Zod schemas ([decision](../decisions/2026-10-09-api-contract-generated-from-zod.md)).
- **The token key** is the one setting with no default. The service does not start without it: the brand's links are worked out from it and Google's tokens are encrypted with it.
- **Settings**, each with the value in this spec as its default: session lengths, the link's expiry, the demo limits, the four read limits, the model id, the region, the app's and the API's addresses.

### Requests for William

Decisions in this spec that change, or add to, what his signed specs and built pages do. Nothing in his specs is edited here.

| For | Needs |
| --- | --- |
| Sign-in (SI-FR-01, SI-FR-12, SI-BR-01) | Sign-in is Google directly, with no Cognito. The spec and the record mention Cognito in the sign-in and the sign-out; the page itself does not change |
| Every page's API client | The API is on its own subdomain, not `/api` on the app's address. `NEXT_PUBLIC_API_BASE_URL` is already read; it needs setting, and requests already send credentials |
| Brief to checklist (BC-FR-07) | Items and questions arrive together when reading finishes. There is no `readUpTo` progress; the page's single "Reading" state is what shows |
| Brief to checklist (BC-FR-06) | No file upload yet. The page's paste-only fallback applies |
| New deal, invite (BC, IN-FR-09 to IN-FR-11) | A deal can only have YouTube videos and Shorts for now. A Reel is refused by the API, so the pages need to hide or flag Reels and the Instagram card |
| Invite (IN-FR-13, IN-FR-17) | The brand's email is stored and nothing is sent. "We've also emailed it" must not show |
| Invite (IN-FR-17) | Creating the link needs the creator's timezone, as the browser reports it: `POST /deals/{id}/invite/link` takes `{ "timezone": "…" }` and refuses a request without it |
| Invite (IN-FR-06) | An amount outside $20.00 to $10,000.00 is refused when it is saved, with status 400, the code `amount_below_minimum` or `amount_above_maximum`, and the field `amount`. `amountProblem` is never sent |
| Invite (IN-BR-04) | The link's address is the app's own. Locally that is `http://localhost:3000/b/…`, which the page's schema turns down because it accepts `https` only |
| Invite (IN-FR-16) | Creating the link is refused with status 409 and the code `terms_incomplete`, `youtube_not_connected` or `paypal_email_missing` |
| Sign-in (SI-FR-02, SI-FR-14) | The demo account starts with a connected YouTube channel and no deals. Seeded deals come as later steps are built |
| Brief to checklist | A new refusal when a limit on reading is reached, with which limit and when it resets |
| Confirm and hold (CH-FR-17) | The brand's deal carries PayPal's public client id for the button |
| All pages | The generated types in `contract/` replace the hand-written schemas, a page at a time |

## Testing Decisions

- A good test here states a situation and checks what someone could observe: the answer a route gives, what a second caller is and is not shown, the rows that exist afterwards, and exactly which calls reached Google, the model and PayPal. Tests are named after the DS-FR or DS-BR they prove.
- **Tooling:** as the money path's. Bun's test runner, the Docker Postgres, the fake PayPal, and new fakes for Google and the model.
- **Routes** are tested through the app, with real cookies, as the webhook route is.
- **Who may see what** gets the most attention:
  - a creator cannot read or change another creator's deal;
  - a brand session for one deal opens no other;
  - the brand's deal never contains the creator's PayPal email;
  - a dead link and an unknown link are indistinguishable;
  - a session ends on sign-out and when its link is turned off.
- **Changing requests** from another origin, or with no origin, are refused.
- **The brief reader:** an item citing a line that is not there is dropped; a bad shape is asked for once more and then fails; a refusal fails; a brief that tries to give instructions changes nothing that code decides; how an item is checked comes from code.
- **Limits:** the sixth read on a demo account, the twenty-first in a day, and the three-hundred-and-first overall are refused and call nothing.
- **Versions and agreeing:** what changed between versions; agreeing to an old version is refused; agreeing opens every post's money or none.
- **Holds:** the three routes over the fake PayPal, including a hold started before agreeing and an order id from another post.
- **The contract:** the generated document matches the one in the repo.
- **Against real services, by hand:** one real brief read by Claude on Bedrock, and one deal taken from a brief to a real sandbox hold through the routes.

## Out of Scope

- **Instagram:** connecting an account, and deals with a Reel.
- **Uploading a brief as a file.**
- **Sending any email:** the link to the brand, or anything else.
- **Seeded deals in the demo account.**
- **Steps 4 to 8:** the draft check, the brand's review, the go-ahead, the live check, and the routes for capture, payout and release. The money path's functions for them exist; their routes come with those specs.
- **Cancelling from the deal pages** (William's cancel spec), and the note on a cancel.
- **A fresh link per review** (William's brand review spec).
- **Deployment:** the domain, infrastructure as code, and the Google app's verification.
- **Verifying a PayPal email with PayPal.**

## Open items

**Added while drafting and accepted by Furqaan at sign-off.** These were not asked in the grill-me session; they are listed so the source of each is clear.

- **DS-FR-03, DS-FR-34:** a creator session lasts 14 days from its last use; a brand session lasts until its link expires.
- **DS-FR-07:** 10 demo accounts an hour from one address, and deletion after 7 days that waits for unfinished money.
- **DS-FR-10:** changing the PayPal email also changes it for every deliverable not yet paid.
- **DS-FR-21, DS-FR-23:** each suggested answer carries its item, and the creator's own words become the item's name, so answering a question never calls the model again.
- **DS-FR-22:** a bad shape is asked for once more before the read fails.
- **DS-FR-31:** the creator's timezone is taken from their browser when the link is created.
- **DS-FR-33:** turning a link off ends every brand session made from it.
- **DS-FR-45:** PayPal's public client id is sent with the brand's deal.
- **DS-BR-01:** a deal that is not the caller's and one that does not exist get the same answer.
- **DS-BR-03:** the origin check, and JSON only, on every changing request.
- **DS-BR-16:** which failed reads count against a limit.
- **The secrets port:** a key from the environment stands in for KMS in development and tests.

**Verified while building.**

- Bedrock accepts a schema-constrained answer from Claude Opus 5.5 through Anthropic's Bedrock SDK on Bun. The account first needed the model's offer accepted, and AWS to restore its quota for the model, which was zero.
- A real brief of 12 lines was read in 16 seconds, using 278 input and 824 output tokens: about 2 cents at Bedrock's price. One of 5 lines took 9 seconds. At 300 reads a day that is about $5 a day for briefs this short; longer ones cost more.
- That brief carried a line telling the reader to ignore its instructions and pass every item. No item or question came from it (DS-BR-04, DS-BR-07).

**To verify while building.**

- What Google shows a creator while the Google app is unverified, and the 100-user cap on it.
- That Google's refresh tokens expire after 7 days while the Google app is in "Testing" (PRODUCT.md "Risks to test first").

**Needs setting up by a person.**

- A Google Cloud OAuth client: its id and secret, and the callback addresses. Until it exists the Google routes are tested against the fake, and the demo account works without it.
- A domain, before deployment.

**Waiting on William.** No Cognito, the API on its own subdomain, the generated contract, and no Instagram for now are shared decisions. Furqaan decided them; William has to agree.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the grill-me session with Furqaan: steps 1 to 3 end to end; Google sign-in run by the backend with no Cognito, and a demo account; the app and the API on one domain as two subdomains; William's four decisions accepted (brand gets in by its link, brand asks and creator changes, the repo layout, the deadline as one shared date); the contract generated from the backend's Zod schemas; briefs read by Claude Opus 5.5 on Bedrock in one call, shown all at once; limits of 20,000 characters, 5 reads per demo account, 20 a day per creator and 300 a day overall; Instagram, brief upload, email and seeded demo deals left for later | [Google directly](../decisions/2026-10-09-creators-sign-in-with-google-directly.md), [One domain](../decisions/2026-10-09-app-and-api-on-one-domain.md), [Generated contract](../decisions/2026-10-09-api-contract-generated-from-zod.md), [Briefs read by Claude](../decisions/2026-10-09-briefs-read-by-claude-opus-on-bedrock.md) |
| 1.0 | Signed by Furqaan, with the twelve items added while drafting accepted as written | none |
| 1.1 | Signed by Furqaan. How the brand's link is kept: a hash and a salt, with the token worked out again from a key each time its creator fetches it, so DS-FR-32 no longer contradicts itself (DS-FR-32, DS-BR-11); an expired link is still returned to its creator, marked expired; the token key is required for the service to start. Found while building: Bedrock's structured answers and the real time and cost of a read are verified; four more requests for William on the invite | [Link worked out again](../decisions/2026-10-09-an-invite-link-is-worked-out-again.md) |
