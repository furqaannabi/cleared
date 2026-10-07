# Cleared

**Status:** Signed off on 6 October 2026. Nothing described here is built yet. What is not yet decided is listed under [Still open](#still-open).

Cleared is where a creator and a brand run a sponsorship deal they have already agreed. The brand's money is held in PayPal, AI checks the creator's video against the brief, and the money is released when the approved post is live.

**Brand deals where the content and the payment clear together.**

It is being built for the PayPal AI Hackathon and runs in the PayPal sandbox, so no real money moves.

## The problem

A creator finishes a sponsored video, posts it, and then waits. Payment sits "in processing" for weeks with no explanation, and the creator has no way to show, item by item, that they did what the brief asked.

The brand has the opposite fear. Paying upfront risks getting nothing, or getting a video with the wrong discount code and no disclosure.

Both sides are missing the same two things: proof of what was delivered, and money that is already committed.

## Who it is for

| | Who | What they do on Cleared |
| --- | --- | --- |
| Main user | The creator | Starts each deal, submits drafts, publishes, gets paid |
| Invited user | The brand | Opens a link, confirms the checklist, approves a PayPal hold, reviews the draft |

The creator is the main user because they feel the problem most and do many deals a year. They bring each brand in with a link, the way a freelancer sends a client an invoice.

Cleared is aimed first at direct deals between small brands and mid-size creators, with no agency in between.

**Cleared is not a marketplace.** Creators and brands do not find each other here. They agree the deal wherever they already do, and bring it to Cleared to run it.

## What is different

The similar projects found as of 6 October 2026 read text or code, and judge the work only once it is public. Cleared differs in four ways.

- **It checks the video itself.** What is said, what appears as on-screen text and what is shown in frame are each checked, and each finding points to a timestamp.
- **It checks before publishing.** A wrong discount code is caught while the video is still a draft and can be fixed. A check that runs only after posting can approve or reject, but cannot help the creator get it right.
- **It ties the post to the creator's real account.** The creator signs in with YouTube or Instagram, and Cleared confirms through the platform that the live post is on that account. Nothing has to be pasted into the content to prove who made it.
- **It uses PayPal accounts both sides already have.** There is no crypto wallet and no token. The brand's money is an ordinary PayPal hold.

## Words used in this document

| Term | Meaning |
| --- | --- |
| Deal | One sponsorship between one creator and one brand. It has one or more deliverables. |
| Deliverable | One post on one platform, with its own amount, deadline, checklist and hold |
| Brief | The brand's written requirements for the deal |
| Checklist | The brief turned into separate items that can each pass or fail |
| Hold | A PayPal authorization: the brand's money is reserved but not yet taken |
| Draft check | AI checking the video file against the checklist before it is published |
| Review window | The 48 hours the brand has to approve or object to a passing draft |
| Re-confirming the hold | Asking PayPal, just before the creator publishes, to confirm the reserved funds are still there. PayPal calls this reauthorizing. |
| Live check | Confirming through the platform's API that the approved post is published |
| Manual approval | A person decides whether the deliverable is paid, in place of the timer or the live check |
| Cleared | A deliverable that has passed its live check and been paid |

## How a deal runs

Each deliverable is checked twice: as a draft, while a mistake can still be fixed, and again once it is live.

| Step | What happens | Runs on |
| --- | --- | --- |
| 1. Brief | The creator pastes or uploads the brief the brand sent. AI turns it into a checklist, cites the line of the brief each item came from, and asks about anything ambiguous. | Claude on Amazon Bedrock, S3 |
| 2. Invite | The creator sets the amount and deadline for each deliverable, connects their YouTube or Instagram account, gives the PayPal email they want to be paid at, and sends the brand a link. | Cognito, Google and Instagram sign-in |
| 3. Confirm and hold | The brand reviews the checklist and can edit it. Once both sides accept the same checklist, amounts and release rule, the brand approves one PayPal hold per deliverable. | PayPal Orders |
| 4. Draft check | The creator uploads the video file. AI checks every item and shows timestamped evidence. The creator fixes any failures and resubmits. | S3, a backend job, Amazon Bedrock |
| 5. Brand review | From a fully passing draft, the brand has 48 hours to approve it or to object to a specific item. Silence clears it. | A backend timer, AG Grid |
| 6. Publish | The creator says they are ready. Cleared re-confirms the hold with PayPal, and then the creator publishes. | PayPal Payments |
| 7. Live check | Cleared confirms through the platform's own API that the approved content is public, on the creator's own account, on time, with the required link, code and disclosure. | A backend job, YouTube Data API, Instagram API |
| 8. Pay | A passing live check captures the hold and pays the creator. Both sides see held, captured and paid, each with its PayPal reference. | PayPal Payments, Payouts, Webhooks |

## Rules

- **Both sides agree the checklist before any money is held.** The checklist is the only thing a deliverable is judged against.
- **Silence clears a passing draft, and nothing else.** If every item passes and the brand says nothing for 48 hours, the draft is cleared to publish. An item the AI fails or is unsure about never clears on a timer: the creator fixes it or the brand accepts it.
- **The review happens before publishing.** A published video cannot be edited, so objections are raised while a fix is still possible. After that, payment follows the live check with no second wait.
- **A creator never publishes without a confirmed hold.** If PayPal cannot confirm the funds at step 6, the creator is told not to publish.
- **The AI never moves money.** It returns findings with evidence. Fixed code confirms the evidence exists, decides, and calls PayPal.
- **A brand objection stops the clock.** Objecting to an item moves that deliverable to manual approval.
- **A missed deadline or a cancelled deal releases the hold** back to the brand.

## When something does not go to plan

| Situation | What happens |
| --- | --- |
| The brief is ambiguous | The AI asks about it at step 1. Nothing is held until both sides accept the same checklist. |
| A draft fails an item | The creator fixes it and resubmits. The review window does not start until every item passes. |
| The AI is unsure about an item | It goes to a person. The creator fixes it or the brand accepts it. It never clears on a timer. |
| The brand says nothing for 48 hours on a fully passing draft | The draft is cleared to publish. |
| The brand objects to an item | The clock stops and that deliverable moves to manual approval. |
| PayPal cannot re-confirm the hold at step 6 | The creator is told not to publish. |
| The live post cannot be tied to the approved draft | The deliverable goes to manual approval. See [Platforms](#platforms) for when this happens. |
| The deadline passes with no approved live post | The hold is released back to the brand. |
| The deal is cancelled | The hold is released back to the brand. |

## What gets checked

Each checklist item is checked against the place the evidence lives.

| Kind of item | Example | Evidence | Checked at |
| --- | --- | --- | --- |
| Said | Mentions the product; says the discount code | Timestamped transcript | Draft check |
| Shown as text | Discount code on screen | On-screen text with a timestamp | Draft check |
| Shown | Product visible and in use; logo on screen | The video itself, with a timestamp | Draft check |
| Timing | Mention within the first 60 seconds; segment at least 45 seconds long | Timestamps of the above | Draft check |
| Written | Link, code or hashtags in the description or caption | The published post | Live check |
| Disclosure | Marked as a paid promotion | The published post | Live check |
| Publication | Public, on the creator's account, posted by the deadline | The platform's record | Live check |

Exact items, such as a code or a link, are matched by code. Items that need judgment go to the AI, which must point to a timestamp. Anything it is unsure of goes to a person.

## Platforms

Version one covers YouTube videos and Shorts, and Instagram Reels. Stories, photo posts and carousels come later.

| | YouTube | Instagram |
| --- | --- | --- |
| Creator connects | Google sign-in, read-only | Instagram sign-in; professional accounts only |
| Draft | The file, plus the same video uploaded to their channel as unlisted | The file |
| Can Cleared fetch the published video? | No. The API does not offer it, and downloading breaks YouTube's terms. | Yes, unless the Reel uses licensed music |
| How the live post is tied to the draft | Same video, switched to public. The file's size and length match YouTube's record of the upload. | The live file's transcript and length match the draft's |
| Also checked live | Own channel, publish date, description, paid-promotion flag | Own account, post date, Reel format, caption |
| Goes to manual approval when | YouTube's file record is unavailable or does not match | The file cannot be fetched |

No field for the paid-partnership label was found in Instagram's API, so on Instagram that item is always a manual check.

## How the money moves

| Stage | What happens in PayPal | What both sides see |
| --- | --- | --- |
| Held | The brand approves an authorization for the deliverable's amount. The money is reserved, not taken. | Held, with the PayPal reference |
| Re-confirmed | Just before publishing, Cleared asks PayPal to confirm the reserved funds again. | Confirmed, or a warning not to publish |
| Captured | After a passing live check, the hold is captured to Cleared's PayPal account. | Captured, with the PayPal reference |
| Paid | Cleared pays the amount out to the creator's PayPal email. | Paid, with the PayPal reference |
| Released | On a missed deadline or a cancellation, the hold is released and the money returns to the brand. | Released |

- **There is one hold per deliverable.** A deal with three posts has three holds, each captured or released on its own.
- **A hold lasts 29 days, and PayPal guarantees the funds only for the first 3.** This is why the hold is re-confirmed before publishing, and why a deliverable's deadline is capped at 21 days after the hold.
- **Capturing straight to the creator's PayPal account is untested.** It would remove the payout step. If PayPal does not allow it, the capture-then-payout path above stays.
- **The sandbox accounts are US accounts.** The build uses US sandbox business and personal accounts, and PayPal payouts need US sandbox recipients.

## Limits in version one

- **Deadlines are capped at 21 days after the hold**, for the reason given above.
- **Payment goes through Cleared's PayPal account**, not directly from brand to creator.
- **The paid-partnership label on Instagram is a manual check.**
- **Instagram creators need a professional account.**
- **A Reel with licensed music cannot be fetched**, so it goes to manual approval.
- **Not included:** Stories, photo posts, carousels, other platforms, finding or matching brands and creators, contracts, tax, and checking that a post stays up after payment.

## Built with

The frontend is hosted on Vercel. Everything behind it uses AWS services or the hackathon's sponsor tools.

| Job | Choice |
| --- | --- |
| Holding, capturing and paying out | PayPal Orders, Payments, Payouts and Webhooks, in the sandbox |
| Reading the brief and judging each item | Claude on Amazon Bedrock |
| What was said, on-screen text and logos, all timestamped | Amazon Bedrock Data Automation |
| What is shown, such as the product in use | A video model on Amazon Bedrock: TwelveLabs Pegasus or Amazon Nova, chosen after a test |
| Frontend | Next.js on Vercel |
| API | Hono on Bun, described with OpenAPI |
| Pipeline and timers | A job queue kept in Postgres, run by the same backend service |
| Data | PostgreSQL on Amazon RDS, through Prisma |
| Backend hosting | One container on Amazon ECS Fargate |
| Sign-in | Cognito, with Google and Instagram sign-in for connecting accounts |
| Files and secrets | S3, KMS |
| Evidence table and brand dashboard | AG Grid and AG Studio |
| PayPal coding help | APIMatic's Context Plugin for PayPal |
| Not used | Render, Bryntum, Channel3, Elastic, Kernel, Zapier, Postman, Astropods |

The backend rows were set on 7 October 2026 and are recorded in [the backend decision](decisions/2026-10-07-backend-hono-bun-prisma-postgres.md).

## Hackathon constraints

| Item | Detail |
| --- | --- |
| Event | PayPal AI Hackathon, "Build what's next with PayPal and AI", on Devpost. Online, no tracks. |
| Hard rule | The project must meaningfully use at least one PayPal technology and must meaningfully use AI. Sandbox only. |
| Submission deadline | 12 November 2026, 12:00pm PT, which is 1:30am IST on 13 November |
| Judging | 1 to 15 December 2026. Winners are announced around 21 December. |
| Sponsor tools used | AG Grid and APIMatic. Using a sponsor's tool is what makes a project eligible for that sponsor's prize. |

The submission needs all of the following:

- A text description of the project and an explanation of which tools were used and how.
- A demo judges can run: a hosted URL, or complete setup and run instructions in the repo. A mockup or static prototype does not count.
- A public GitHub repo with an open-source licence file visible at the top of the repo page.
- A public YouTube video under three minutes, showing the project running.
- Sandbox test accounts and instructions, if the demo needs credentials.

Judging has two stages. Stage one is pass or fail: does the project fit the theme and use the required tools. Stage two scores five equally weighted criteria. Ties are broken in the order listed, so Technological Implementation decides first.

| Criterion | What the rules ask |
| --- | --- |
| Technological Implementation | How thoroughly and skilfully the project uses the PayPal Developer Platform and AI |
| Design | Whether it delivers a complete, coherent product experience |
| Potential Impact | Whether it makes a credible, specific case for solving a real problem |
| Innovation / Idea | How novel the concept is and how it differs from existing concepts |
| Presentation | Whether the video clearly shows the project working end to end |

## Risks to test first

- **Judges cannot connect their own accounts.** Instagram allows only tester accounts the team adds until Meta reviews the app, and Google caps an unverified app at 100 users. The hosted demo needs pre-connected demo creator accounts and sample files.
- **The demo must survive until 15 December.** Google sign-ins made while the app is in "Testing" expire after 7 days, so the app must be switched to "In production" before submission.
- **Re-confirming a hold cannot be tested on a fresh one.** PayPal allows it only after day 3, so sandbox holds need creating on day one of the build.
- **Capturing straight to the creator is unverified.** If PayPal refuses, the capture-then-payout path already covers it.
- **Spoken discount codes may be misheard.** Speech-to-text may garble a code such as GLOW20. Amazon Transcribe with a custom vocabulary is the fallback.
- **Video analysis is billed per minute.** The public demo needs a cap on upload length and count.
- **The repo is public.** PayPal sandbox credentials and platform tokens must stay out of it.

## The name

The concept was first written up as SponsorProof, a name already in use by another public project. Cleared was chosen instead: the content is cleared to publish, and the payment clears. No product of that name was found in creator sponsorship.

The repo is [github.com/furqaannabi/cleared](https://github.com/furqaannabi/cleared), public, under an MIT licence.

## Still open

- **Which Bedrock video model.** To be chosen after testing both on a real sponsored clip.
- **Whether a hold can be captured straight to the creator's PayPal account**, which would remove the payout step.
- **Manual approval.** Who decides, and what happens to the hold if nobody does before the deadline, is not yet defined.
- **A live check that fails on something still fixable.** A description or caption can be edited after publishing, so a missing link could be corrected. Whether the creator gets a chance to fix it is not yet defined.
- **Team.** The build is planned for two people. Who the second person is, and what they take, is not settled.
- **First spec.** Not yet written. It should turn [How a deal runs](#how-a-deal-runs) into numbered requirements before any code.

## References

- [PayPal AI Hackathon on Devpost](https://paypalaihackathon.devpost.com/), with its [official rules](https://paypalaihackathon.devpost.com/rules) and [resources](https://paypalaihackathon.devpost.com/resources)
- [PayPal: authorize a payment and capture later](https://developer.paypal.com/docs/checkout/standard/customize/authorization/)
- [PayPal: authorization and honor period](https://developer.paypal.com/payment-methods/auth-honor)
- [YouTube Data API: videos resource](https://developers.google.com/youtube/v3/docs/videos)
- [Instagram media reference](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/)
- [Instagram API overview](https://developers.facebook.com/docs/instagram-platform/overview/)
- [Google: manage app audience](https://support.google.com/cloud/answer/15549945)
- [Bedrock Data Automation: video output](https://docs.aws.amazon.com/bedrock/latest/userguide/bda-ouput-video.html)
- [TwelveLabs Pegasus 1.2 on Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-twelvelabs-pegasus-v1-2.html)
- [AG Grid: Hackathon, PayPal and AG Studio](https://www.ag-grid.com/blog/hackathon-paypal-and-ag-studio/)
- [PayPal + AG Studio boilerplate](https://github.com/paypaldev/hackathon-paypal-ag-grid-boilerplate)
- [APIMatic Context Plugins](https://www.apimatic.io/blog/context-plugins)
