# Cleared

**Status:** Draft. Not yet signed off. Nothing described here is built yet.

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

## Words used in this document

| Term | Meaning |
| --- | --- |
| Deal | One sponsorship between one creator and one brand |
| Deliverable | One post on one platform, with its own amount, deadline, checklist and hold |
| Brief | The brand's written requirements for the deal |
| Checklist | The brief turned into separate items that can each pass or fail |
| Hold | A PayPal authorization: the brand's money is reserved but not yet taken |
| Draft check | AI checking the video file against the checklist before it is published |
| Review window | The 48 hours the brand has to approve or object to a passing draft |
| Live check | Confirming through the platform's API that the approved post is published |
| Cleared | A deliverable that has passed its live check and been paid |

## How a deal runs

| Step | What happens |
| --- | --- |
| 1. Brief | The creator pastes or uploads the brief the brand sent. AI turns it into a checklist, cites the line of the brief each item came from, and asks about anything ambiguous. |
| 2. Invite | The creator sets the amount and deadline for each deliverable, connects their YouTube or Instagram account, and sends the brand a link. |
| 3. Confirm and hold | The brand reviews the checklist and can edit it. Once both sides accept the same checklist, the brand approves one PayPal hold per deliverable. |
| 4. Draft check | The creator uploads the video file. AI checks every item and shows timestamped evidence. The creator fixes any failures and resubmits. |
| 5. Brand review | From a fully passing draft, the brand has 48 hours to approve it or to object to a specific item. Silence clears it. |
| 6. Publish | The creator says they are ready. Cleared re-confirms the hold with PayPal, and then the creator publishes. |
| 7. Live check | Cleared confirms that the approved content is public, on the creator's own account, on time, with the required link, code and disclosure. |
| 8. Pay | A passing live check captures the hold and pays the creator. Both sides see held, captured and paid, each with its PayPal reference. |

## Rules

- **Both sides agree the checklist before any money is held.** The checklist is the only thing a deliverable is judged against.
- **Silence clears a passing draft, and nothing else.** If every item passes and the brand says nothing for 48 hours, the draft is cleared to publish. An item the AI fails or is unsure about never clears on a timer: the creator fixes it or the brand accepts it.
- **The review happens before publishing.** A published video cannot be edited, so objections are raised while a fix is still possible. After that, payment follows the live check with no second wait.
- **A creator never publishes without a confirmed hold.** If PayPal cannot confirm the funds at step 6, the creator is told not to publish.
- **The AI never moves money.** It returns findings with evidence. Fixed code confirms the evidence exists, decides, and calls PayPal.
- **A brand objection stops the clock.** Objecting to an item moves that deliverable to manual approval.
- **A missed deadline or a cancelled deal releases the hold** back to the brand.

## What gets checked

Each checklist item is checked against the place the evidence lives.

| Kind of item | Example | Evidence |
| --- | --- | --- |
| Said | Mentions the product; says the discount code | Timestamped transcript |
| Shown as text | Discount code on screen | On-screen text with a timestamp |
| Shown | Product visible and in use | The video itself, with a timestamp |
| Timing | Mention within the first 60 seconds; segment at least 45 seconds long | Timestamps of the above |
| Written | Link, code or hashtags in the description or caption | The published post |
| Disclosure | Marked as a paid promotion | The published post |
| Publication | Public, on the creator's account, posted by the deadline | The platform's record |

Exact items, such as a code or a link, are matched by code. Items that need judgment go to the AI, which must point to a timestamp. Anything it is unsure of goes to a person.

## Platforms

Version one covers YouTube videos and Shorts, and Instagram Reels.

| | YouTube | Instagram |
| --- | --- | --- |
| Creator connects | Google sign-in, read-only | Instagram sign-in; professional accounts only |
| Draft | The file, plus the same video uploaded to their channel as unlisted | The file |
| Can Cleared fetch the published video? | No | Yes, unless the Reel uses licensed music |
| How the live post is tied to the draft | Same video, switched to public; the file matches YouTube's record of the upload | The live file's transcript and length match the draft's |
| Goes to manual approval when | YouTube's record is unavailable or does not match | The file cannot be fetched |

## Limits in version one

- **Deadlines are capped at 21 days after the hold.** A PayPal hold lasts 29 days, and the funds are guaranteed only for the first 3, which is why the hold is re-confirmed before publishing.
- **Payment goes through Cleared's PayPal account.** The hold is captured to Cleared and paid out to the creator.
- **The paid-partnership label on Instagram is a manual check.**
- **Not included:** Stories, photo posts, carousels, other platforms, finding or matching brands and creators, contracts, tax, and checking that a post stays up after payment.

## Built with

| Job | Choice |
| --- | --- |
| Holding, capturing and paying out | PayPal Orders, Payments, Payouts and Webhooks |
| Reading the brief and judging each item | Claude on Amazon Bedrock |
| What was said and shown on screen, with timestamps | Amazon Bedrock Data Automation |
| What is shown in the video | A video model on Amazon Bedrock |
| Pipeline and timers | AWS Step Functions, EventBridge Scheduler, Lambda |
| App | Next.js on AWS Amplify |
| Data and files | DynamoDB, S3 |
| Creator dashboard | AG Grid on tablet and up, cards on phones. The evidence view uses cards ([decision](decisions/2026-10-06-evidence-view-cards.md)) |

## Still open

- Whether the creator-first model above is confirmed, or the brand should start the deal instead.
- The 48-hour review window and the 21-day deadline cap.
- Which Bedrock video model, to be chosen after testing on a real sponsored clip.
- Whether a hold can be captured straight to the creator's PayPal account, which would remove the payout step.
