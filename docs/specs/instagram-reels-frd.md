# Instagram Reels: FRD

**Status:** Signed by William (revision 1.3). It adds Instagram to what William's invite, publish and pay, and profile pages call; those additions are listed for him. One of its decisions is product behaviour he shares (no Meta review for the hackathon) and is recorded as Furqaan's for him to agree.

**Surface:** Backend. Instagram Reels through the whole of [How a deal runs](../PRODUCT.md#how-a-deal-runs): a creator connects their Instagram account, a deal can hold a Reel, and the Reel gets its own go-ahead, its own way of saying "I've posted it", and its own live check. Everything else a Reel needs already exists and is not rebuilt: the checklist, the draft check on the file, the review, the money path, the brand's decisions, cancelling and rulings.

**Scope of this build:** connecting Instagram, allowing a Reel in a deal, the Reel's go-ahead, posting with the Reel's link, the Reel's live check and the match between the live Reel and the approved draft. Every money step is the [money path](money-path-frd.md)'s own function, called and never re-decided here. It is built and tested locally over a stand-in for Instagram, with a real tester account for the checks run by hand. **Before any of it is built, Meta's API is proven by hand (IG-FR-01).**

## Problem Statement

Version one promises YouTube and Instagram Reels, and a Reel is refused the moment a creator adds one to a deal. Most sponsored short video is on Instagram, so a creator whose deal is for a Reel cannot use Sponing at all.

A Reel is also not a YouTube video with another name. There is no unlisted upload, so nothing can be looked at before it is public. Instagram re-encodes every file, so the live video cannot be matched by its size. The paid-partnership label is not in the API. And a Reel that uses licensed music cannot be fetched at all. Each of these is a place where a careless rule would pay for a post nobody checked, or refuse one that was fine.

## Solution

A creator connects their Instagram account once, with one read-only permission. A deal can then hold a Reel beside its YouTube posts, and the Reel goes through the same checklist, draft check and review as any other post.

When the draft is approved the creator asks for the go-ahead. Sponing checks it can still read their account, and the money path re-confirms the hold. The creator posts the Reel and pastes its link. Sponing finds that Reel among the creator's own posts, fetches its video, and decides by fixed code whether it is the approved draft: the same length, and the same words in the same order. The caption is checked for the link, code and hashtags the checklist asks for.

What Instagram will not show, Sponing does not guess: the paid-partnership label, and a Reel whose video cannot be fetched, go to the brand to confirm, with the same email and the same 48 hours as on YouTube. A live Reel that is not the approved draft goes to the brand to accept or not.

## User Stories

1. As a creator, I want to connect my Instagram account with a read-only permission, so that Sponing can confirm my Reel is on my own account without being able to post for me.
2. As a creator, I want to be told plainly if my account cannot be connected, so that I know whether to switch to a professional account or try again.
3. As a creator, I want my connection to keep working without signing in again every two months, so that a deal does not stall on an expired sign-in.
4. As a creator, I want to add a Reel to a deal beside my YouTube posts, so that one deal covers everything I agreed with the brand.
5. As a creator, I want to be told before I send the terms that Instagram is not connected, so that I do not invite a brand to a deal I cannot finish.
6. As a creator, I want my Reel's draft checked as any draft is, so that I fix problems before anything is public.
7. As a creator, I want the go-ahead to tell me if Sponing can no longer read my Instagram account, so that I reconnect before I post, not after.
8. As a creator, I want to be told not to post when PayPal cannot confirm the brand's hold, so that I do not post for money that is not there.
9. As a creator, I want to say I have posted by pasting my Reel's link, so that Sponing checks the right post.
10. As a creator, I want to be told when the link is not a Reel on my account, so that I paste the right one.
11. As a creator, I want to know that I must paste the link before my deadline, so that I do not lose the payment by forgetting.
12. As a creator, I want each live-check item to show what was found in my caption, so that I can see why it passed or what to change.
13. As a creator, I want to fix my caption and have it checked again, so that a missing hashtag does not cost me the deal.
14. As a creator, I want to be told when my Reel's video could not be fetched and why, so that I understand why the brand is being asked.
15. As a creator, I want to be told to reconnect Instagram when Sponing can no longer read my account, so that I can put it right.
16. As a brand, I want the live Reel matched to the draft I approved, so that I pay for the video I agreed to.
17. As a brand, I want to be asked when Sponing could not check the paid-partnership label, so that I can look at it myself before I am charged.
18. As a brand, I want to be asked when the live Reel is not the draft I approved, so that I decide whether to pay for it.
19. As a brand, I want a link to the live Reel that Instagram itself gave Sponing, so that I am never sent somewhere a person typed.
20. (Removed in revision 1.1: there are no demo accounts.)
21. As the team, I want Meta's API proven by hand before anything is built on it, so that a month is not spent on a field Meta does not return.
22. As the team, I want a Reel found only among the creator's own posts, so that nobody can claim someone else's Reel.
23. As the team, I want the Reel's video fetched only from the address Instagram's API returned, so that a typed link can never make the service fetch something else.
24. As the team, I want the match decided by fixed code with stated limits, so that no model decides whether money moves.
25. As the team, I want the live check to say nothing when it could not read Instagram, so that silence never pays for a post nobody looked at.
26. As the team, I want nothing in a caption to be able to change a result code decides, so that a caption cannot talk its way to a pass.
27. As William, I want the routes to follow the paths in my specs, so that my pages change as little as possible.

## Functional requirements

### Proving access first

| ID | Requirement |
| --- | --- |
| IG-FR-01 | **Before anything else is built,** a check run by hand connects one tester account and shows what Meta's API really returns: the account's id, name and type; a list of its media; one Reel's link, short code, date, format, caption and video address; the video fetched and its length read; and a token renewed. Its findings are written into this spec's open items. If a Reel's link, short code or video address does not come back as Meta documents, the build stops and this spec gets another look ([decision](../decisions/2026-10-11-instagram-reels-whole-path-access-proven-first.md)). |

### Connecting Instagram

| ID | Requirement |
| --- | --- |
| IG-FR-02 | **Connect.** A signed-in creator asks to connect Instagram. The backend sends the browser to Instagram's own sign-in, asking for one permission: to read the account's profile and media ([decision](../decisions/2026-10-11-instagram-login-read-only.md)). The request is tied to the creator's session, as the YouTube connection is. |
| IG-FR-03 | **Coming back.** Instagram sends the browser back with a one-time code. The backend exchanges it for a token, exchanges that for one that lasts 60 days, and reads the account: its id, its name and its type. Only a professional account is accepted. |
| IG-FR-04 | **Stored.** The account is stored for the creator as their Instagram connection, replacing any they had: Instagram's id for it, its name, the token encrypted, and when the token ends. The creator's profile lists it beside YouTube. The token is never returned. |
| IG-FR-05 | **Not connected.** If the creator declines, the account is not a professional one, or Instagram fails, nothing is stored and the browser is sent back to the app with the reason, as for YouTube. |
| IG-FR-06 | **Kept alive.** A token lasts 60 days and can be renewed while it still works. A daily job renews every token more than 7 days old. One that cannot be renewed is lost access (IG-FR-13, IG-FR-27). |

### A Reel in a deal

| ID | Requirement |
| --- | --- |
| IG-FR-07 | **A deal can hold Reels.** A post's platform can be an Instagram Reel, beside YouTube videos and Shorts, under the same limits on a deal's posts. |
| IG-FR-08 | **Each platform must be connected** before the terms go to the brand: a deal with a Reel needs Instagram connected, and one with a YouTube post needs YouTube. A deal with only Reels does not need YouTube. The refusal names the platform that is missing. |
| IG-FR-09 | **The checklist is read the same way.** For a Reel, a written item is about its caption, a disclosure item is the paid-partnership label, and a publication item is the Reel being public on the creator's own account. |
| IG-FR-10 | **The draft is the file alone.** It is sent, checked and reviewed exactly as the [draft check](draft-check-and-review-frd.md) says. Nothing is uploaded to Instagram before the go-ahead. |

### The go-ahead

| ID | Requirement |
| --- | --- |
| IG-FR-11 | **Ask.** The creator of a Reel whose draft is approved asks for the go-ahead. No link is given: there is nothing on Instagram to point at yet ([decision](../decisions/2026-10-11-a-reels-go-ahead-checks-the-account-then-the-hold.md)). |
| IG-FR-12 | **The account is read** with the creator's stored access before anything else. If it can be read, the money path is asked for the go-ahead (MP-FR-10) and its answer is passed on as it is. |
| IG-FR-13 | **Lost access.** If the account cannot be read (access revoked, expired, or never renewed), the go-ahead is refused with "reconnect Instagram" and nothing is asked of PayPal. If Instagram itself fails, the creator is asked to try again, and nothing is asked of PayPal. |

### Posting

| ID | Requirement |
| --- | --- |
| IG-FR-14 | **"I've posted it," with the Reel's link.** The creator gives the link of the Reel. A link that is not an Instagram Reel or post link is refused. Its short code is taken from it by code; the link itself is never fetched. |
| IG-FR-15 | **Found among the creator's own posts.** Sponing lists the creator's own recent media, newest first, and looks for that short code. If it is there and is a Reel, it is the post. If it is not there, the answer says the Reel is not on the creator's account. If it is there and is not a Reel, the answer says so. |
| IG-FR-16 | **Recorded.** The Reel is recorded for the post: Instagram's id for it, the link Instagram itself gives for it, and Instagram's date for it, kept as evidence. The moment is recorded as when the post was published (PT-FR-10), the money path is told (MP-FR-16), and the live check starts. Saying so again starts nothing new, and a different Reel cannot be given once one is recorded. |
| IG-FR-17 | **Without a go-ahead.** A link is accepted once the draft is approved and the hold is held, whether or not a go-ahead is running. A creator who posts without one does so at their own risk, as on YouTube (PT-FR-03). |
| IG-FR-18 | **No link, nothing seen.** When a go-ahead ends, and at the deadline, the money path asks whether a post was published (MP-FR-15, MP-FR-22). For a Reel the answer is yes only if one is recorded. Sponing does not look for a Reel it was not told about ([decision](../decisions/2026-10-11-a-reel-nobody-gave-a-link-for-is-not-looked-for.md)). The link must therefore be given before the deadline. |

### The live check

| ID | Requirement |
| --- | --- |
| IG-FR-19 | **A job,** started with the change that records the Reel. It reads the Reel's record from Instagram once: that it is still on the creator's account, that it is a Reel, its caption, and the address of its video. |
| IG-FR-20 | **The video is fetched once,** from the address Instagram's API returned and no other, into the private bucket beside the draft, under the draft's own limit on size. Its length is read from the file and its speech is read as a draft's is. It is deleted once the match is decided. (1.2) A video larger than the draft's limit, or of a kind the service does not read, is not kept and counts as one that could not be fetched (IG-FR-24). |
| IG-FR-21 | **The match,** by fixed code ([decision](../decisions/2026-10-11-a-live-reel-is-matched-by-length-then-words.md)). The live Reel is the approved draft when its length is within 2 seconds of the draft's and at least 90% of the draft's spoken words are in the live Reel in the same order, compared after the same normalising as the draft check (DR-FR-13). It is **not the approved file** when the length is more than 2 seconds off, or under 50% of the words are there. It **cannot be decided** in between, or when the draft has fewer than 20 spoken words to compare. |
| IG-FR-22 | **Decided once.** The match is recorded with the Reel. A later check of the same Reel reads the caption again and does not fetch or read the video again. |
| IG-FR-23 | **Each item checked at the live check** gets a result with evidence from the live Reel. A written item that carries a link, code or hashtag is matched by code in the caption. A written item that needs judgment goes to Claude with the caption, and its pass counts only if the words it quotes are in the caption. A publication item passes when the Reel is on the creator's account. A disclosure item is never decided: the paid-partnership label is not in Instagram's API. |
| IG-FR-24 | **One answer for the money path,** the worst finding winning, by the rule already signed for YouTube ([decision](../decisions/2026-10-10-which-live-check-finding-gives-which-answer.md)): **cannot be fixed** when the live Reel is not the approved file; **fixable** when a required link, code or hashtag is missing from the caption, or a written item is judged missing; **cannot decide** when the Reel's video cannot be fetched (Instagram gives no address for one with licensed music; and, from 1.2, a video that is too large, of a kind the service does not read, or whose reading failed three times), when the match cannot be decided, when the checklist has a disclosure item, or when a written item's judgment is unsure; **passed** otherwise. |
| IG-FR-25 | **The answer is given to the money path** (MP-FR-17 to MP-FR-21), and each item's result and the answer are recorded with when the check ran, as for YouTube (PT-FR-14). What follows is publish to paid's, unchanged: the creator's time to fix and "check again" (PT-FR-15), the brand's confirm, object and accept with its link and its email (PT-FR-18 to PT-FR-23), the creator's and the brand's views (PT-FR-23, PT-FR-24), cancelling and rulings. |
| IG-FR-26 | **When Instagram fails** (an error, a timeout or a rate limit), or the video cannot be fetched or read for a reason that may pass, the check gives the money path no answer and tries again with growing waits (PT-FR-16). (1.2) The reading of a fetched video is tried at most three times ([decision](../decisions/2026-10-12-a-reels-reading-is-tried-three-times.md)). After a third failed reading the video counts as one that could not be fetched (IG-FR-24), and the brand is asked. A failed reading is one that ended as failed or ran past its time limit; a call that could not be made is not counted. Instagram failing, and the video failing to download, are tried again without a limit. |
| IG-FR-27 | **Lost access, and a Reel that is gone,** give no answer either. The check stops and the creator's post says to reconnect Instagram, or that the Reel could not be found. Reconnecting starts the check again (PT-FR-17). |
| IG-FR-28 | **What both sides are shown** gains, for a Reel: the live post's link as Instagram gave it; and, among the things the check could not decide, the paid-partnership label, a video that could not be fetched, and a match that could not be decided. |

### Demo accounts

| ID | Requirement |
| --- | --- |
| IG-FR-29 | **Removed in revision 1.1.** There are no demo accounts: every creator signs in with Google ([decision](../decisions/2026-10-11-no-demo-accounts.md)). |

### Limits

| ID | Requirement |
| --- | --- |
| IG-FR-30 | **Testers only, for now.** Until Meta has reviewed the app, Instagram lets only accounts the team has added as testers connect ([decision](../decisions/2026-10-11-no-meta-review-for-the-hackathon.md)). Anyone else is turned away by Instagram itself, and the app is told the connection did not happen. |

## Business rules

| ID | Rule |
| --- | --- |
| IG-BR-01 | Instagram is only ever read. One permission is asked, to read the account's own profile and media, and no route publishes, comments or messages. |
| IG-BR-02 | A creator's Instagram token is encrypted at rest, never sent to the browser and never logged. The app's secret is server-side only. |
| IG-BR-03 | No route or job here moves money or decides a money state. Each calls one function of the money path and reports what it answers. |
| IG-BR-04 | No model moves money or gives the money path an answer. The match is fixed code over two readings with stated limits. Claude judges only written items that need judgment, and its pass counts only if its quote is in the caption. |
| IG-BR-05 | The live check gives the money path an answer only when it has read the Reel's record. A check that could not read Instagram, for any reason, says nothing. |
| IG-BR-06 | "Cannot decide" is for what Instagram did not show and for a match that is unclear. It is never the answer for something Sponing looked at and found wrong. |
| IG-BR-07 | A Reel is found only among the media Instagram lists for the creator's own account. A link to anyone else's Reel can never be recorded. |
| IG-BR-08 | A link a person typed is never fetched: only its short code is taken, and only from Instagram's own addresses. The Reel's video is fetched only from the address Instagram's API returned, over HTTPS, into the private bucket, with a limit on its size. |
| IG-BR-09 | A caption, an account's name and a Reel's spoken words are untrusted. They are given to a model as material to examine, never as instructions, and nothing in them can change a result code decides or cause any action. |
| IG-BR-10 | The connection is tied to the creator's session by a value used once, so a connection started by one person cannot be finished as another. |
| IG-BR-11 | Every creator route checks the post belongs to a deal of that creator. A post that is not the caller's and one that does not exist get the same answer. |
| IG-BR-12 | Logs carry ids only: creator, deal and deliverable ids, Instagram's own ids, counts and timings. Never a caption, a link, a transcript, a token or the address of a Reel's video. |

## Implementation Decisions

- **The whole path, with access proven first** ([decision](../decisions/2026-10-11-instagram-reels-whole-path-access-proven-first.md)).
- **Modules.** Each is a small interface with its tests:
  - **An Instagram port:** the sign-in address; exchanging a code and renewing a token; reading the account; finding one of the account's media by short code; reading one media's record. It answers with what was read, "not found", or "cannot be read" (access lost). The real one calls Instagram's API over plain HTTPS; tests use a stand-in.
  - **The Reel link:** a pure function from a link to a short code, or nothing.
  - **The match:** a pure function from two lengths and two readings to same, different or cannot decide.
  - **The Reel's live check:** a pure function from the Reel's record, the match and the post's live-check items to each item's result and the one answer. Written items go through the judge as on YouTube.
  - **Publishing** chooses by the post's platform: the YouTube path as built, or the Reel's go-ahead, posting and live check. The money path, the notices, the views, cancelling and rulings are shared and unchanged.
  - **Routes:** thin. Each checks the session, validates the body, calls a module and maps the answer.
- **The money path is not changed.**
- **The approved draft's reading is not made again.** The draft check keeps what it read beside the draft's file until the draft is deleted, and the match reads it from there.
- **Schema.** The stored connection gains when its token ends. The record of the video a post was published as becomes the record of the post on its platform: the platform's id for it, the platform's own link and date, and for a Reel the match once decided. The list of platforms gains the Reel. (1.2) The live check counts a Reel's failed readings.
- **Paths** follow William's specs: connecting mirrors YouTube's (`/connect/instagram` and its callback); the go-ahead takes no link for a Reel; "I've posted it" takes the Reel's link.
- **No new library.** Instagram is called with plain HTTPS, as Google and YouTube are.
- **Settings,** each with the value in this spec as its default: the app's id and secret; the 2-second and 90%, 50% and 20-word limits of the match; how many of the account's recent media are searched (100); and how old a token is before it is renewed (7 days). (1.2) And how many times a fetched video is read (3).
- **Cost.** Each Reel is read by Data Automation one more time, at its live check. Nothing else an AI does is repeated. (1.2) A reading that fails is paid for too, so a Reel costs at most three readings.

### Requests for William

Decisions in this spec that change, or add to, what his signed specs and built pages do. Nothing in his specs is edited here.

| For | Needs |
| --- | --- |
| Invite (IN-FR-09 to IN-FR-11), profile | Instagram can be connected: `GET /connect/instagram`, and the profile's accounts list gains it. Sending terms can be refused with `instagram_not_connected` |
| New deal (BC) | A Reel is no longer refused |
| Publish and pay (PP-FR-01) | For a Reel the go-ahead takes no link. New refusals: `reconnect_instagram`, `instagram_unavailable` |
| Publish and pay (PP-FR-07) | "I've posted it" for a Reel sends `{ url }`. New refusals: `not_an_instagram_link`, `reel_not_found`, `not_a_reel`. The page should say the link must be given before the deadline |
| Publish and pay (PP-FR-08) | The line "if you forget to tap, we check" is not true for a Reel: Sponing does not look for a Reel it was not given |
| Publish and pay (PP-FR-13, PP-FR-14) | What the check could not decide gains `paid_partnership_label`, `reel_not_fetched` and `reel_match`; the creator's post can say `reconnect_instagram` or that the Reel was not found |
| Demo | **Revision 1.1:** there are no demo accounts, so no sample Reel is offered |
| All pages | The generated types in `contract/` gain these as they are built |

## Testing Decisions

- A good test here states a situation and checks what someone could observe: the answer a route gives, what each side is shown, the rows that exist afterwards, the jobs scheduled, and exactly which calls reached Instagram, PayPal and the money path. Tests are named after the IG-FR or IG-BR they prove.
- **Tooling:** as publish to paid's. Bun's test runner, the Docker Postgres, the fake PayPal, and a stand-in for Instagram beside the ones for YouTube, storage, media, speech and the judge.
- **The Reel link** gets known-good and known-bad cases: reel links, post links, links with extra parameters, links to other sites dressed as Instagram, and text that is not a link.
- **The match** is tested as a table: the same length and words; a length just inside and just outside 2 seconds; words at 90%, between, and under 50%; the same words in another order; a draft with too little speech; an empty reading.
- **The Reel's live check** is tested as a table: every finding against the answer it gives, and combinations to prove the worst wins.
- **Looking before answering** gets the most attention: a check that could not read Instagram gives the money path nothing; lost access gives nothing; "cannot decide" is never given for a fault that was seen.
- **Whose Reel it is:** a link to a Reel that is not in the creator's own media is never recorded, whatever the link says.
- **What is fetched:** nothing is ever fetched from a typed link; the video is fetched only from the address the stand-in Instagram returned; a video over the size limit is cut off and kept nowhere.
- **Untrusted input:** a caption that gives instructions changes no result; a model's pass whose quote is not in the caption does not count.
- **The go-ahead:** no call to PayPal before the account is read; each refusal.
- **No link:** a go-ahead that ends, and a deadline that comes, with no Reel recorded see nothing published, and Instagram is not asked.
- **Connecting:** the token is stored encrypted and never returned; a declined or failed connection stores nothing; a connection cannot be finished in another session; a token is renewed by the job and one that cannot be is lost access.
- **The limit on readings (1.2):** a reading that fails once or twice is tried again and can still pass; a third failure gives "cannot decide" with the video not fetched, and no fourth reading is started; Instagram failing and a failed download never count towards it; a video too large or of a kind not read is never called the wrong file.
- **Against the real service, by hand:** IG-FR-01, first; then one whole Reel deal with a tester account.

## Out of Scope

- **Stories, photo posts and carousels.**
- **Facebook Login,** and anything that needs a Facebook Page.
- **Publishing to Instagram,** comments, messages and insights.
- **Reading the paid-partnership label,** which Instagram's API does not show.
- **Finding a Reel the creator did not give a link for.**
- **Disconnecting an account** from the page.
- **Meta's review of the app,** and so real creators connecting Instagram.
- **Checking a Reel again after it has passed.** A creator who edits the caption after being paid is not looked at.

## Open items

**Added while drafting and accepted by Furqaan at sign-off.** These were not asked in the question session; they are listed so the source of each is clear.

- **IG-FR-06:** a daily job renews tokens more than 7 days old.
- **IG-FR-15:** the 100 most recent media are searched for the Reel's short code.
- **IG-FR-17:** a Reel's link is accepted without a running go-ahead, at the creator's own risk.
- **IG-FR-18:** the link must be given before the deadline. A Reel posted in time whose link comes after the deadline is not paid, because the hold is released at the deadline.
- **IG-FR-20:** the fetched video is deleted once the match is decided.
- **IG-FR-21:** under 50% of the words is "not the approved file", and a draft with fewer than 20 spoken words cannot be matched by words at all, so it goes to the brand.
- **IG-FR-22:** the video is not fetched or read again when only the caption is checked again.
- **IG-FR-24:** a checklist with a disclosure item makes every such Reel "cannot decide", so it never passes without the brand.
- **IG-FR-27:** a Reel that is gone from Instagram gives no answer, as a YouTube video that is gone does (PT-FR-17).

**Added in revision 1.2 and accepted by Furqaan at sign-off.** Two cases the build met that the spec had not stated; both are built as written here.

- **IG-FR-20:** a live Reel's video larger than the draft's limit is cut off, kept nowhere, and counts as not fetched.
- **IG-FR-20:** a video of a kind the service does not read has no length to compare, and counts as not fetched. It is never "not the approved file".

**To verify, by IG-FR-01, before anything is built.**

- That a media's link, short code, date, format and caption come back for the account's own Reels, and that the short code is the one in the link a person copies from Instagram.
- That a Reel's video address comes back, can be fetched over HTTPS without the token, and is left out for a Reel with licensed music.
- That the account's type comes back, and which values a professional account has.
- How many media one listing returns, and how the next page is asked for.
- That a token lasts 60 days, from when it can be renewed, and what a revoked one answers.
- Whether Instagram accepts a redirect address that is not HTTPS. If it does not, connecting cannot be tried on a laptop without a tunnel, and is tried against the deployed API.
- What Instagram's API costs against its rate limits for one Reel deal.

**Needs setting up by a person.**

- A Meta app with Instagram Login, its id and secret, and its redirect address.
- The team's own Instagram accounts added as testers, each a professional account.

**Waiting on William.** The requests in the table above, and his agreement to no Meta review for the hackathon.

## Revision

| Version | Change | Record |
| --- | --- | --- |
| 0.1 | First draft, from the question session with Furqaan: the whole Reel path in one spec with Meta's API proven by hand first; Instagram Login with one read-only permission; a go-ahead that checks the account can be read and then the hold; a live Reel matched to the draft by length and then words, with the unclear going to the brand; the paid-partnership label and a Reel that cannot be fetched are "cannot decide", by the rule already signed for YouTube; a Reel nobody gave a link for is not looked for; a shared demo Instagram account; no Meta review for the hackathon | [Whole path, access first](../decisions/2026-10-11-instagram-reels-whole-path-access-proven-first.md), [Instagram Login](../decisions/2026-10-11-instagram-login-read-only.md), [A Reel's go-ahead](../decisions/2026-10-11-a-reels-go-ahead-checks-the-account-then-the-hold.md), [The match](../decisions/2026-10-11-a-live-reel-is-matched-by-length-then-words.md), [No link](../decisions/2026-10-11-a-reel-nobody-gave-a-link-for-is-not-looked-for.md), [Shared demo account](../decisions/2026-10-11-demo-accounts-read-a-shared-instagram-account.md), [No Meta review](../decisions/2026-10-11-no-meta-review-for-the-hackathon.md) |
| 1.0 | Signed by Furqaan, with the nine items added while drafting accepted as written | none |
| 1.1 | Demo accounts are removed, so the shared demo Instagram account goes (IG-FR-29) with its setting. Until Meta reviews the app, Instagram works for the team's tester accounts only | [No demo accounts](../decisions/2026-10-11-no-demo-accounts.md) |
| 1.1 | Signed by Furqaan | none |
| 1.2 | A fetched video is read at most three times, then the brand is asked (IG-FR-26). A video too large, or of a kind the service does not read, counts as not fetched (IG-FR-20, IG-FR-24) | [Three readings](../decisions/2026-10-12-a-reels-reading-is-tried-three-times.md) |
| 1.2 | Signed by Furqaan | none |
| 1.3 | The product is named Sponing: wording only, no behaviour changes. "Cleared" stays as the paid status | [The product is named Sponing](../decisions/2026-10-14-the-product-is-named-sponing.md) |
| 1.3 signed | Revision 1.3 signed by William | none |
