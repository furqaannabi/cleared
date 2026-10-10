# Publish to paid: FRD

**Status:** Signed by Furqaan (revision 1.0). It accepts William's cancel spec as the backend's rules and adds to what his publish and pay, confirm and hold, and cancel pages call; those additions are listed for him. Two of its decisions are product behaviour he shares (the shared demo channel, and email for the brand's notices) and are recorded as Furqaan's for him to agree.

**Surface:** Backend. Steps 6 to 8 of [How a deal runs](../PRODUCT.md#how-a-deal-runs), and cancelling, as an API the pages William has built can call: the creator asks for the go-ahead and publishes, Cleared checks the live post against YouTube's own record of it, the brand decides what the check could not, and both sides see the hold captured and the creator paid, or released.

**Scope of this build:** the routes, the data behind them, the live check, the two emails to the brand, the commands for a person at Cleared to rule, and the cancel routes. Every money step is the [money path](money-path-frd.md)'s own function, called and never re-decided here. It is built and tested locally: Postgres in Docker, the PayPal sandbox, and stand-ins for YouTube and email, with a real YouTube channel and Amazon SES for the checks run by hand. Deployment is a later spec, and so is everything under [Out of Scope](#out-of-scope).

## Problem Statement

A draft can now be approved, and then the deal stops again. The creator has no way to ask whether it is safe to publish, nothing looks at the live post, and nobody is paid. The money path can re-confirm a hold, capture it and pay out, but only a script can ask it to. William's publish and pay and cancel pages show made-up results.

This is the step where money moves, so it is where a mistake costs most. A creator who publishes against a hold that has lapsed has given the work away. A brand that pays for a post that is not the one it approved, or that drops the link it was promised, has been charged for something else. And the two moments after publishing where silence decides (pay when Cleared could not look, refund when the post cannot be fixed) are only fair if the brand actually knows a decision is waiting.

## Solution

When a draft is approved, the creator uploads the same file to their YouTube channel as unlisted and asks for the go-ahead with its link. Cleared reads YouTube's record of that upload and checks it is the approved file on the creator's own channel, before anything is public. Then the money path re-confirms the hold with PayPal. Only with both does the creator see "you can post now".

Once the video is public, Cleared reads its record again: public, on the creator's channel, the same file, the link, code and hashtags in the description, and the paid-promotion mark. A passing check captures the hold and pays the creator, less Cleared's fee. Something the creator can still fix gives them time to fix it. A post that is not the approved file goes to the brand to accept or not. What YouTube would not tell Cleared goes to the brand to confirm, and the brand is emailed, because there its silence pays.

Either side can cancel a post until there is a go-ahead. Both sides see every money stage with its PayPal reference, and every state that is not "paid" says why and what happens next.

## User Stories

1. As a creator, I want to ask for the go-ahead with my unlisted video's link, so that I know it is safe to publish before I do.
2. As a creator, I want to be told before publishing if the video on my channel is not the approved file, so that I can upload the right one while it can still be fixed.
3. As a creator, I want to be told not to publish when PayPal cannot confirm the brand's hold, so that I do not publish for money that is not there.
4. As a creator, I want the go-ahead to say until when it lasts, so that I know how long I have.
5. As a creator, I want to ask again when a go-ahead has run out, so that a busy day does not end the deal.
6. As a creator, I want to tell Cleared I have posted, so that the live check starts at once.
7. As a creator, I want Cleared to check my channel itself when my go-ahead ends, so that forgetting to tap does not cost me.
8. As a creator, I want each live-check item to show its result with evidence from the live post, so that I can see what was found.
9. As a creator, I want to fix a missing link or disclosure and have it checked again, so that a small slip does not cost me the deal.
10. As a creator, I want to know until when I can fix it, so that I do not run out of time unawares.
11. As a creator, I want to be told to reconnect YouTube when Cleared can no longer read my channel, so that I can put it right.
12. As a creator, I want to see the hold captured and the payout sent, each with its PayPal reference, so that I know where my money is.
13. As a creator, I want to see Cleared's fee and what I am paid as exact figures, so that nothing is a surprise.
14. As a creator, I want every "not paid yet" state to say why and what happens next, so that I am never left with "processing".
15. As a creator, I want to have a payout sent again after correcting my PayPal email, so that a typo does not lose my money.
16. As a creator, I want a new PayPal email to apply to my posts that have not been paid out yet, so that I do not have to fix each one.
17. As a creator, I want to cancel a post before the go-ahead, with a note, so that the brand gets its hold back and knows why.
18. As a creator, I want to see when the brand cancelled and its note, so that I know the deal is off and why.
19. As a brand, I want to be emailed when a live post needs my decision, so that my silence is never used against me without my knowing.
20. As a brand, I want to give my own email for those notices when I agree, so that they come to me and not to an address someone else typed.
21. As a brand, I want to confirm a live post Cleared could not check, or object with a reason, so that I am not charged for a post I dispute.
22. As a brand, I want to accept a live post that failed on something that cannot be fixed, so that I can still pay for work I am happy with.
23. As a brand, I want to see that my hold was taken, for how much and with which PayPal reference, so that I can match it to my records.
24. As a brand, I want to see that a hold was released, when and why, so that I know the money is back.
25. As a brand, I want to cancel a post before the go-ahead, with a note, so that I can back out while nothing is public.
26. As a brand, I want never to see the creator's PayPal email or payout problems, so that their details stay theirs.
27. As a demo visitor, I want to take the sample clip through the go-ahead, the live check and the payout, so that I can see a deal finish.
28. As a person at Cleared, I want to list the posts waiting for a ruling with both sides' reasons, so that I can decide.
29. As a person at Cleared, I want to record "pay" or "release" with my name, so that a disputed post is settled before day 28.
30. As the team, I want the live check to give the money path an answer only when it has actually looked, so that silence never pays for a post nobody checked.
31. As the team, I want nothing in a video's description to be able to change a result code decides, so that a description cannot talk its way to a pass.
32. As the team, I want every money step to stay the money path's own, so that this spec adds routes and never a second place where money is decided.
33. As William, I want the real routes to follow the provisional paths and shapes in my specs, so that my pages change as little as possible.

## Functional requirements

### The go-ahead

| ID | Requirement |
| --- | --- |
| PT-FR-01 | **Ask.** The creator of a post whose draft is approved asks for the go-ahead, giving the link of the video they uploaded to their channel. A link that is not a YouTube video link is refused. The video's id is taken from the link by code. |
| PT-FR-02 | **The video is read** from YouTube with the creator's read-only access before anything else. It must exist and be on the creator's connected channel. Its file must be the approved draft's: the same size in bytes, and the same length to within a second. Each failure is refused with its own reason, and nothing is asked of PayPal. |
| PT-FR-03 | **Unlisted or already public.** A video that is unlisted is the usual case. One that is already public is accepted too: the creator published before asking, at their own risk, and everything that follows is the same. A private video is refused, because the brand could never see it. |
| PT-FR-04 | **When YouTube will not say.** If YouTube returns the video but not its file's size and length, the video is accepted on its channel alone, and the live check will not be able to decide the match (PT-FR-13). |
| PT-FR-05 | **Then the hold.** With the video accepted it is recorded for the post, and the money path is asked for the go-ahead (MP-FR-10). Its answer is passed on as it is: go until a time, wait until a time, or not confirmed. The money path's refusals are passed on with their reasons. |
| PT-FR-06 | **Asking again.** The creator can ask again after a go-ahead ends, after "not confirmed", and once a "wait until" time has come. Until a post is published they can give a different video, which is read and matched afresh. |
| PT-FR-07 | **Lost access.** If YouTube cannot be read for the creator at all (access revoked or expired), the go-ahead is refused with "reconnect YouTube", and nothing is asked of PayPal. |

### Posting

| ID | Requirement |
| --- | --- |
| PT-FR-08 | **"I've posted it."** The creator says the video is public. Cleared reads the recorded video's record at once. If it is public, the money path is told a post was published (MP-FR-16) and the live check starts. If it is not public yet, the answer says so and nothing changes. |
| PT-FR-09 | **If they forget.** When a go-ahead ends, and again at the deadline, the money path asks whether a post was published (MP-FR-15, MP-FR-22). The answer is read from YouTube: the recorded video, public. If it is, the live check starts as if the creator had said so. |
| PT-FR-10 | **When it was published** is the moment Cleared first saw the recorded video public. YouTube's own date is kept beside it as evidence and decides nothing. |

### The live check

| ID | Requirement |
| --- | --- |
| PT-FR-11 | **A job.** The live check is a job, written with the change that starts it. It reads the video's record from YouTube once: whether it is public, its channel, its description, its paid-promotion mark, and its file's size and length. |
| PT-FR-12 | **Each item checked at the live check** gets a result with evidence from the live post. A written item that carries a link, code or hashtag is matched by code in the description, after the same normalising as on-screen text (DR-FR-13). A written item that needs judgment goes to Claude with the description, and its pass counts only if the words it quotes are in the description. A disclosure item passes when the video is marked as a paid promotion. A publication item passes when the video is public on the creator's channel. |
| PT-FR-13 | **One answer for the money path,** the worst finding winning ([decision](../decisions/2026-10-10-which-live-check-finding-gives-which-answer.md)): **cannot be fixed** when the public video is not the approved file or not on the creator's channel; **fixable** when a required link, code or hashtag is missing from the description, or the video is not marked as a paid promotion, or a written item is judged missing; **cannot decide** when YouTube does not return the file's record or the paid-promotion mark, or a written item's judgment is unsure; **passed** otherwise. |
| PT-FR-14 | **The answer is given to the money path** (MP-FR-17 to MP-FR-21), which alone decides what follows: capture, the creator's time to fix, or the brand's 48 hours. The items' results and the answer are recorded with when the check ran. |
| PT-FR-15 | **Check again.** After a fixable failure the creator can have the post checked again, while the money path's fix window is open. Each check reads YouTube afresh and replaces the last results. Outside the window it is refused. |
| PT-FR-16 | **When YouTube fails** (an error, a timeout or a quota refusal), the check gives the money path no answer. The job tries again with growing waits. Nothing is shown of a check that did not finish. |
| PT-FR-17 | **Lost access** (PT-FR-07) gives no answer either. The creator's post says to reconnect YouTube, and the check runs when they have. The money path's deadline runs meanwhile, as it would for any post not checked in time. |

### The brand's decisions after publishing

| ID | Requirement |
| --- | --- |
| PT-FR-18 | **Confirm or object.** When the live check could not decide, the brand has the money path's 48 hours to confirm the post or object with a reason of 1 to 500 characters (MP-FR-18). Each is passed to the money path. |
| PT-FR-19 | **Accept.** When the live check failed on something that cannot be fixed, the brand has the money path's 48 hours to accept the post anyway (MP-FR-21). |
| PT-FR-20 | **A link for the brand.** When either 48 hours start, a fresh link to that post is made for the brand, by the review link's rules (DR-FR-44, DR-FR-45). It stops opening new sessions when the brand has decided or the time is up. |
| PT-FR-21 | **An email.** When either 48 hours start, the brand is emailed that link, with which post it is about, what it is asked, and until when ([decision](../decisions/2026-10-10-email-for-the-brands-two-notices-after-publishing.md)). It goes to the address the brand gave when it agreed; else to the one the creator gave at the invite; else none is sent, and the creator's post carries the link to send. It is sent once for each window, as a job. |
| PT-FR-22 | **The brand's own address.** When the brand agrees to the terms it can give an email for these notices. It is optional, stored for the deal, and never shown to the creator. |
| PT-FR-23 | **Where it stands, for the brand.** The brand's view of a post and of its deal gain every state after approval: the creator may post until a time; the live check is running; the brand's confirmation or acceptance is wanted until a time, with what or why; a person at Cleared is deciding, by when; the hold was taken, with the amount, PayPal's reference, the time and whether the creator has been paid; a capture was refused and is being tried until a time; approved but not paid; released, when and why. Never the creator's PayPal email or a payout's troubles. |

### What the creator sees of the money

| ID | Requirement |
| --- | --- |
| PT-FR-24 | **The creator's post** gains: the go-ahead as the money path has it; the published post's link and when it was published; the live check's overall state with the time that matters (fix by, brand by, ruling by) and each live-check item's result and evidence; the capture with its reference, time, amount, fee and payout; a refused capture and until when it is tried; the payout with its state, the email it went to, PayPal's reference, a reason when it did not arrive, and whether it can be sent again. Amounts are decimal strings (MP-BR-05). |
| PT-FR-25 | **States past approved.** The post's state, the deals list and its status line carry: posting, published, captured, paid, approved but not paid, and released with every reason the money path has. |
| PT-FR-26 | **Send it again.** The creator can have a payout that ended unpaid sent again (MP-FR-30). The money path decides whether it can be; its refusal is passed on. |
| PT-FR-27 | **A new PayPal email** saved by the creator replaces the payout email of every deliverable of theirs whose payout has not been sent to PayPal ([decision](../decisions/2026-10-10-a-paypal-email-change-reaches-where-no-payout-has-started.md)). A payout already with PayPal keeps the email it went to; the profile's answer says which posts those are. This completes DS-FR-10. |

### Cancelling

| ID | Requirement |
| --- | --- |
| PT-FR-28 | **Cancel a post.** The creator or the brand can cancel one post of their deal, from the post's own page, the invite page or the brand's deal page, with an optional note of up to 300 characters. Each route answers with that page's data. |
| PT-FR-29 | **A held post** is cancelled by the money path (MP-FR-33), which decides whether it is allowed and releases the hold. Its refusal is passed on with the reason: a go-ahead is running, a post is published, or the deliverable is finished. |
| PT-FR-30 | **A post not yet held** is cancelled without the money path releasing anything: one with money opened is closed as cancelled by the money path (MP-FR-34); one before the brand has agreed is closed in the deal's own record. |
| PT-FR-31 | **Whether it can be cancelled.** Every post, on every page that lists it, says whether it can be cancelled now, or why not, and whether a hold attempt is waiting at PayPal. |
| PT-FR-32 | **Cancelled.** Both sides see who cancelled, when, and the note. A post cancelled before it was held reads as closed. The deals list and the brand's deal show cancelled posts and a deal whose posts are all cancelled. |
| PT-FR-33 | **A deal with nothing left.** Once every post of a deal is closed or released, its invite link and any review link stop working, with the one answer a dead link gives (DS-FR-35). |

### Rulings

| ID | Requirement |
| --- | --- |
| PT-FR-34 | **List.** A command lists the posts waiting for a person at Cleared to rule: the deal, the post, the brand's objection, the live check's findings, and by when a ruling is due. |
| PT-FR-35 | **Rule.** A command records "pay" or "release" for one post, with the name of who ruled, and passes it to the money path (MP-FR-19). It is run by a person with access to the service, never by a route ([decision](../decisions/2026-10-10-a-ruling-is-a-command-not-a-page.md)). |

### Demo accounts

| ID | Requirement |
| --- | --- |
| PT-FR-36 | **A shared channel.** A demo account's YouTube is one real channel the team owns, connected once. Every read of YouTube for a demo account goes through that channel's read-only access, with the same code as any creator's ([decision](../decisions/2026-10-10-demo-accounts-read-a-shared-channel.md)). The channel holds the sample clip, public, with a description that meets the sample deal's written items. |

## Business rules

| ID | Rule |
| --- | --- |
| PT-BR-01 | No route or job here moves money or decides a money state. Each calls one function of the money path and reports what it answers. The money path's rules are not repeated or overridden. |
| PT-BR-02 | No model moves money or gives the money path an answer. Claude judges only written items that need judgment, its pass counts only if its quote is in the description, and fixed code turns the findings into the one answer (PT-FR-13). |
| PT-BR-03 | The live check gives the money path an answer only when it has read the video's record. A check that could not read YouTube, for any reason, says nothing. Silence never pays for a post nobody looked at. |
| PT-BR-04 | "Cannot decide" is for what YouTube did not return or a judgment that is unsure. It is never the answer for something Cleared looked at and found wrong. |
| PT-BR-05 | A go-ahead is given only for a video Cleared has read on the creator's own channel. No "post now" is ever shown without the money path's go-ahead. |
| PT-BR-06 | A video's title, description and channel name are untrusted. They are given to a model as material to examine, never as instructions, and nothing in them can change a result code decides or cause any action. |
| PT-BR-07 | YouTube is only ever read. The access asked for is read-only, and no route writes to a creator's channel. |
| PT-BR-08 | Every creator route checks the post belongs to a deal of that creator. Every brand route checks the session is for the deal and the post is in it. A post that is not the caller's and one that does not exist get the same answer. |
| PT-BR-09 | The brand never sees the creator's PayPal email, a payout's state or reason, or the creator's account details. The creator never sees the brand's own email. |
| PT-BR-10 | A note with a cancel and a reason with an objection are untrusted plain text. They are kept and shown as text, never as markup, and decide nothing. |
| PT-BR-11 | An email carries a link that opens one deal. It is sent only to the brand, by the order in PT-FR-21, and its address and its link are never logged. |
| PT-BR-12 | Logs carry ids only: creator, deal, deliverable and video ids, PayPal's references, and each service's own ids, counts and timings. Never a description, a note, a reason, an email address, a link or a token. |
| PT-BR-13 | Amounts are whole cents inside and decimal strings outside. No amount is ever a floating-point number. |
| PT-BR-14 | A ruling is made by a named person through a command. No model, timer or route rules, except the money path's own day 28. |
| PT-BR-15 | A cancel is allowed or refused by the money path's rule (MP-FR-33). This spec stores the note beside it and adds nothing to when a hold may be released. |

## Implementation Decisions

- **The unlisted video is given with the request for the go-ahead** ([decision](../decisions/2026-10-10-the-unlisted-video-is-given-with-the-go-ahead.md)), so a wrong file is found while nothing is public.
- **Lost YouTube access decides nothing** ([decision](../decisions/2026-10-10-lost-youtube-access-decides-nothing.md)). The creator reconnects.
- **Modules.** Each is a small interface with its tests:
  - **A YouTube port:** read one video's record with a creator's stored access. It answers with the record, "not found", or "cannot be read" (access lost). The real one calls the YouTube Data API; tests use a stand-in. It extends the Google port deal set-up built.
  - **The video link:** a pure function from a link to a video id, or nothing.
  - **The match:** a pure function from an approved draft's file and YouTube's file record to same, different, or unknown.
  - **The live check:** a pure function from the video's record and the post's live-check items to each item's result and the one answer. Written items that need judgment go through the judge port the draft check built, with their quotes verified.
  - **Publishing:** the go-ahead, "I've posted it", checking again, and the answer to the money path's question whether a post was published.
  - **After publishing:** the brand's confirm, object and accept, and the links and emails that go with them.
  - **An email port:** send one plain-text message to one address. The real one is Amazon SES; tests use a stand-in.
  - **Cancelling:** the four routes, the note, and closing a post that has no money yet.
  - **Rulings:** the two commands.
  - **Routes:** thin. Each checks the session, validates the body, calls a module and maps the answer.
- **The money path is not changed.** Every function this spec needs exists. The one question it asks the outside (whether a post was published) is answered by this spec's publishing module through the interface it already has.
- **The views.** The creator's post and the brand's review, built for the draft check, are extended with what the money path reports. Neither decides a state.
- **Schema.** New records for: the video recorded for a post and when it was first seen public; each live check and its items' results; the note with a cancel and the closing of a post with no money; the brand's own email; and the emails sent. Review links gain the reason they were made.
- **Paths** follow the provisional ones in William's specs (PP, CN) wherever they exist.
- **New library:** AWS's SES client, for the one port that sends email. It replaces hand-written signed HTTP calls. The YouTube Data API is called with plain HTTP, as Google's sign-in is.
- **Settings,** each with the value in this spec as its default: the one-second tolerance on a video's length, the live check's retries, the sender address, and which connected channel demo accounts read.

### Requests for William

Decisions in this spec that change, or add to, what his signed specs and built pages do. Nothing in his specs is edited here.

| For | Needs |
| --- | --- |
| Publish and pay (PP-FR-01) | Asking for the go-ahead takes the unlisted video's link: `POST /deliverables/{id}/go-ahead` with `{ videoUrl }`. New refusals, each with its own code: not a YouTube link, video not found, not on your channel, not the approved file, video is private, reconnect YouTube |
| Publish and pay (PP-FR-06) | "I've posted it" sends no link for YouTube; the video is the one given at the go-ahead. If it is not public yet the answer says so |
| Publish and pay (PP-FR-09 to PP-FR-15) | The post says "reconnect YouTube" when Cleared cannot read the channel, in place of a live check result |
| Confirm and hold (CH-FR-14) | Agreeing can carry the brand's own email for notices: `POST /brand/deals/{id}/agree` with `{ version, email? }`. The page needs the field and one line saying what it is for |
| Publish and pay (PP-FR-14, PP-FR-13) | The brand is emailed when its confirmation or acceptance is wanted. Where no address is known, the creator's post carries the link to send, as for a draft review |
| Draft check (DC-FR-52) | A review link can now also be about a live post |
| Profile (IN-FR-12) | Saving a PayPal email answers with which posts keep the old one, because their payout is already with PayPal |
| Demo | A demo deal can only be finished with the sample clip, whose link the page should offer at the go-ahead |
| All pages | The generated types in `contract/` gain these routes as they are built |

## Testing Decisions

- A good test here states a situation and checks what someone could observe: the answer a route gives, what the other side is and is not shown, the rows that exist afterwards, the jobs scheduled, and exactly which calls reached YouTube, the email service, PayPal and the money path. Tests are named after the PT-FR or PT-BR they prove.
- **Tooling:** as the draft check's. Bun's test runner, the Docker Postgres, the fake PayPal, and stand-ins for YouTube and email.
- **The video link** gets known-good and known-bad cases: watch links, short links, Shorts links, links with extra parameters, links to other sites dressed as YouTube, and text that is not a link.
- **The match:** the same size and length; one byte different; a second and a half different; no file record.
- **The live check** is tested as a table: every finding against the answer it gives, and combinations to prove the worst wins.
- **Looking before answering** gets the most attention: a check that could not read YouTube gives the money path nothing; lost access gives nothing; "cannot decide" is never given for a fault that was seen.
- **Untrusted input:** a description that gives instructions changes no result; a model's pass for a written item whose quote is not in the description does not count.
- **The go-ahead:** no call to PayPal before the video is accepted; each refusal; a different video on a later ask; an already-public video.
- **Who may see what:** the brand's views never contain the payout email or a payout's reason; the creator's never contain the brand's own email; a brand session reaches no post outside its deal.
- **Emails:** which address is used, in order; one email for each window; none when no address is known; nothing of the address or the link in the log.
- **Cancelling:** each route over the fake PayPal; the money path's refusals passed on; a post with no money closed; the link dead once nothing is left.
- **The PayPal email:** a change reaches a post with no payout started and not one whose payout is with PayPal.
- **Against real services, by hand:** one video read from a real channel, to settle the open questions about YouTube's record; one email sent through SES; and one deal taken from the go-ahead to paid through the routes in the PayPal sandbox.

## Out of Scope

- **Instagram and Reels.**
- **A page for rulings,** or any sign-in for people at Cleared.
- **Email for anything else:** the invite, a draft review, a cancel, a payout.
- **Checking a post again after it has passed.** A creator who edits the description after being paid is not looked at.
- **Finding the unlisted video for the creator.** They paste its link.
- **Changing a payout that is already with PayPal** when the PayPal email changes.
- **Deployment,** Google's verification of the app, and SES production access.

## Open items

**Added while drafting and accepted by Furqaan at sign-off.** These were not asked in the question session; they are listed so the source of each is clear.

- **PT-FR-03:** a video that is already public is accepted at the go-ahead, and a private one is refused. The shared demo video is always public, so the demo needs this.
- **PT-FR-04:** a video whose file record YouTube does not return is still given a go-ahead, on its channel alone.
- **PT-FR-06:** the creator can give a different video on a later ask, until a post is published.
- **PT-FR-10:** a post counts as published when Cleared first sees it public, not by YouTube's own date.
- **PT-FR-12:** a written item that needs judgment is judged by Claude, with its quote checked against the description.
- **PT-FR-13:** a written item judged missing is fixable, and one judged unsure is "cannot decide".
- **PT-FR-21:** the email is plain text, sent once for each window.
- **PT-FR-30:** a post cancelled before the brand agrees is closed in the deal's own record, as it has no money to close.
- **The one-second tolerance** on a video's length.

**To verify while building.**

- That read-only access returns a video's file size and length to its owner. If it does not, every live check would be "cannot decide" on the match, and the rule needs another look.
- What YouTube reports as a video's date when it is switched from unlisted to public.
- That the paid-promotion mark is returned for the owner's own video.
- How much of YouTube's daily quota a deal uses.
- That SES delivers from the sender address, and what the brand's email looks like in a real inbox.

**Needs setting up by a person.**

- The Google app moved from Testing to In production, before any real deal and before the demo channel is connected: in Testing every stored access dies after 7 days ([PRODUCT.md, "Risks to test first"](../PRODUCT.md#risks-to-test-first)). Reading YouTube is a sensitive scope, so until Google verifies the app it shows a warning and is capped at 100 users.
- The Google OAuth client's redirect addresses, which are not yet accepted (deal set-up's open item).
- The shared demo channel: made, connected once, with the sample clip uploaded and public, and its description written to meet the sample deal.
- An SES sender: a verified address or domain. Until AWS grants production access, only verified addresses receive mail.

**Waiting on William.** The requests in the table above, and his agreement to the shared demo channel and to email for the brand's two notices. His [cancel spec](cancel-frd.md) is now the backend's rule too.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the question session with Furqaan: steps 6 to 8 and cancelling in one spec; the unlisted video given with the request for the go-ahead and matched before anything is public; a shared demo channel the team owns; the live check strict on the file and lenient on what YouTube will not say; lost YouTube access decides nothing; a ruling is a command; a PayPal email change reaches where no payout has started; email through Amazon SES for the brand's two notices after publishing, to an address the brand gives when it agrees; William's cancel spec accepted as written | [Video with the go-ahead](../decisions/2026-10-10-the-unlisted-video-is-given-with-the-go-ahead.md), [Shared demo channel](../decisions/2026-10-10-demo-accounts-read-a-shared-channel.md), [Live check answers](../decisions/2026-10-10-which-live-check-finding-gives-which-answer.md), [Lost access](../decisions/2026-10-10-lost-youtube-access-decides-nothing.md), [Rulings](../decisions/2026-10-10-a-ruling-is-a-command-not-a-page.md), [PayPal email](../decisions/2026-10-10-a-paypal-email-change-reaches-where-no-payout-has-started.md), [Email for the brand](../decisions/2026-10-10-email-for-the-brands-two-notices-after-publishing.md) |
| 1.0 | Signed by Furqaan, with the nine items added while drafting accepted as written | none |
