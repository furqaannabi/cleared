# Full deal: a sandbox run by hand

One YouTube deal, run from sign-in to paid in the PayPal sandbox, by a person playing both the creator and the brand. The automated suite stops at the invite ([decision](../decisions/2026-10-12-playwright-live-suite-stops-at-the-invite.md)); this covers the rest. It is for William and Furqaan to find what breaks before the submission, not for judges.

The words in quotes are what the screen should say, from the specs. A screen that says something else is a finding, even when the deal still moves on. Write each finding in the log at the end with its step and FR id.

## Before you start

| What | Detail |
| --- | --- |
| The app | Local (`localhost:3000` with the backend on `localhost:4000`) or hosted. Write which in the log |
| Creator | A Google account with a YouTube channel you can upload to |
| Brand | A second browser, or a private window, so its cookie stays apart from the creator's |
| PayPal | A US sandbox **personal** account to approve holds as the brand, and a US sandbox email for the creator's payouts (a personal account's email, so the payout is claimed). Both from developer.paypal.com → Testing tools → Sandbox accounts. Sandbox only: never a real login |
| The brief | A short real brief that names a discount code (said and on screen), a link for the description, and "show the product in use" |
| The video | An MP4 or MOV under 15 minutes that does what the brief asks: says the code, shows it on screen, shows the product. A second cut with the on-screen code missing, for path B |
| Backend | Furqaan confirms the S3 bucket, Data Automation, Nova and Claude on Bedrock are set up. The draft check's adapters are not yet proven against AWS ("To verify while building" in `docs/specs/draft-check-and-review-frd.md`), so step 6 may be the first time they run for real |

Check at both widths where it says so: a phone (or the browser at 375 px) and a desktop.

## Path A: everything passes

### 1. Sign in (creator)

1. Open the landing page. One way in: "Sign in with Google".
2. Sign in. A first sign-in lands on `/welcome`; a later one on Overview.
3. On the welcome page, skip the rows. "All optional. Anything you skip, we ask for when you send your first invite."

Expect: Overview in the rail, current; "You have no deals yet." if the account is new. (SI-FR-01, SI-FR-06, HM-FR-01)

### 2. New deal

1. "New deal" in the rail (phone: in the Deals sheet).
2. Brand name, one post: YouTube video. "Continue".

Expect: `/deals/{id}/checklist`; the rail shows "{brand} · Checklist". (BC-FR-01 to BC-FR-03)

### 3. The brief and the checklist

1. Paste the brief. Try one under 40 characters first: "This looks too short to be a brief. Paste the whole thing." Then the real one, and "Make the checklist".
2. "Reading your brief…" with the numbered lines, then the items all at once.
3. Check each item: its kind, the brief line it cites, and how it is checked ("Exact match", "AI, with a timestamp", "At the live check"). The code should be exact; the link should be at the live check.
4. Answer any question, or "Leave it out". Reword one item; add one with "Add an item" and see "Added by you, not in the brief".
5. "Checklist ready". Expect: "Your checklist is ready. Next you'll set the amount and deadline for each post and invite {brand}." (BC-FR-07 to BC-FR-17)

Look for: an item citing a line that does not say it, or a code checked by AI instead of exact match. Either is a finding for the brief reader (Furqaan).

### 4. Invite

1. "Set amounts and invite {brand}".
2. Amount: try `10` first. Expect a refusal (the minimum is $20.00). Then `150`.
3. Deadline: 7 days. Try 22: "Up to 21 days. PayPal only holds money for 29 days, so Sponing keeps a margin."
4. "Connect YouTube" if not connected. Back on the page, the card says the channel's name and "Connected".
5. Your PayPal email: the sandbox payout email.
6. "Create link for {brand}". Copy the link.

Expect: the deal at "{brand} · Waiting for brand"; the terms read-only. (IN-FR-04 to IN-FR-17)

### 5. Confirm and hold (brand, in the second browser)

1. Open the link. "Opening your deal…", then `/brand/deals/{id}` with the token gone from the address bar.
2. The terms: the post, "Within 7 days of your hold", $150.00, "Paid to {creator}'s PayPal" and never the email. Each item says "From your brief: …" or "Added by {creator}".
3. Optional detour: "Ask for a change" on one item, "Save note", then "Send to {creator}" in the bar at the bottom → "Yes, send"; answer it as the creator, "Send updated terms to {brand}", and see "Version 2" with "Changed" on the brand's side. (CH-FR-10 to CH-FR-13)
4. "Agree to these terms". Expect "Agreed · version {n} · {date}".
5. "Approve with PayPal" (CH 1.9: PayPal's own "PayPal" button under "Approve the hold with PayPal or a card"; one click opens PayPal). In PayPal's window, log in with the sandbox personal account and approve. Never with the business account Sponing's PayPal app belongs to: PayPal refuses it as "the seller for this purchase". Use a different account from the creator's payout email, so the sandbox shows who paid whom.

Expect: "Held · $150.00 · PayPal ref …", then "All held. {creator} is making the posts." On the creator's side: "Held · $150.00 · PayPal ref …" and "Open draft check". (CH-FR-14 to CH-FR-19, CH-FR-25)

Also try once: close PayPal's window without approving. Expect "You closed PayPal. Nothing was held." and the button back.

Once CH 1.9 is built, on a second deal: "Debit or Credit Card" with a sandbox test card. Expect PayPal's card form inside the page, then "Held" as above. No Pay Later, PayPal Credit or Venmo should be offered anywhere.

In the PayPal sandbox (developer.paypal.com → the business account's activity), the order should show as authorized, not captured.

### 6. Draft check (creator)

1. "Open draft check". The page shows "No draft" with every item at "Not checked yet" or "At live check".
2. Upload the good video.
3. "Checking" on every draft-check item. Time how long the run takes.
4. Results: each item with its status, its evidence, its timestamp, and its brief line. Click a timestamp: the video seeks to it.

Expect: every item passed, then "Fully passing": "{brand} has until {date, time} to review. If they say nothing, you're cleared to publish." and "Copy link for {brand}". (DC-FR-01 to DC-FR-07, DC-FR-12, DC-FR-52)

Look for: a pass with no timestamp, a timestamp past the video's end, or "Unsure" shown as a pass. Each is a finding for the evidence check (Furqaan).

### 7. Brand review (brand)

1. As the creator, "Copy link for {brand}" and open it in the brand's browser.
2. "Every item passed. You have until {date, time} to review" and "If you say nothing, the draft is approved."
3. Play the draft; click an item; the video seeks.
4. "Approve draft" → "Approve this draft? {creator} can then post it. Your $150.00 is taken only once the live post checks out." → "Yes, approve".

Expect: brand "Approved · {date}"; creator "{brand} approved this draft" and "Don't publish yet. Sponing confirms {brand}'s hold with PayPal first." (RW-FR-15, RW-FR-16, RW-FR-22, DC-FR-51)

Do not wait the 48 hours; silence clearing is tested in path C.

### 8. Go-ahead and publish (creator)

1. Upload the same file to your channel as **unlisted**, unchanged.
2. Paste its link in "Your unlisted video's link" and "Get the go-ahead".
3. "Checking {brand}'s hold with PayPal…", then "You can post now. Post before {time}". The money card shows Confirmed.
4. Make the video public in YouTube Studio. Add the brief's link and code to the description, and tick the paid-promotion box.
5. "I've posted it" → "Is the video public on your channel? We check it's the same video you uploaded as unlisted." → "Yes, it's public".

Expect: "Checking your live post…", then each "At live check" item passes with evidence from the post. (PP-FR-01 to PP-FR-11)

Try once before step 4: "I've posted it" while still unlisted. Expect "Your video isn't public yet. Make it public, then tap again."

If YouTube does not return the file's size and length, the live check cannot tie the post to the draft and goes to "We couldn't check {what} automatically." That is an open item in `docs/specs/publish-to-paid-frd.md`: record it, then carry on with path D's step 1 to finish.

### 9. Paid (both)

1. Creator: "Your live post checked out.", then "Captured · $150.00 · PayPal ref …" and "Sending $142.50 to {email} ($150.00 less Sponing's 5% fee of $7.50)."
2. Then "Paid · $142.50 · PayPal ref …", the cleared seal, and "Cleared. Nothing more to do on this post."
3. Brand: "Your $150.00 was taken on {date} · PayPal ref …" and "{creator} was paid."
4. Payments page: the post under Paid, $142.50. Overview's money card agrees.
5. In the sandbox: the capture on the business account, the payout on the creator's sandbox account.

(PP-FR-16 to PP-FR-18, PP-FR-30, HM-FR-23)

## Path B: a fix and an objection

A new deal, held as in steps 2 to 5.

1. Upload the cut with the on-screen code missing. Expect that item "Fix needed" with a "Suggested fix", and the rest passed. No review window. (DC-FR-06, DC-FR-46)
2. If any item is "Unsure": "Ask {brand} to accept". Brand: "Ask {creator} to fix it" with a note. Creator: the item says "{brand} asked you to fix this". (DC-FR-14, DC-FR-17, RW-FR-14)
3. Upload the good video. Expect "Was Fix needed, now Passed" on the fixed item. (DC-FR-19, DC-FR-48)
4. Brand: "Add objection" on one passed item, a note, "Save objection". Expect the send bar at the bottom: "1 objection for {creator}". "Send to {creator}" → "Yes, send" in the bar. Expect "You asked {creator} to fix 1 item. The clock has stopped." (RW-FR-17, RW-FR-18, RW-FR-21)
5. Creator: "{brand} asked you to fix 1 item. Upload a new draft by {date}." (DC-FR-50)
6. Brand: "Approve this draft anyway". Creator: approved, as step 7.

## Path C: cancelling, and silence

1. Creator cancels a held post before the go-ahead: "Cancel this post" → "{brand}'s $150.00 hold goes back to them. This can't be undone." Expect "Released" on both sides with "You cancelled this post on {date}.", and the authorization voided in the sandbox. (CN-FR-01 to CN-FR-10)
2. Brand cancels a deal before agreeing. Expect the creator sees "Cancelled" with the brand's note. (CN-FR-15)
3. During a go-ahead: no cancel button, and "You can't cancel now: you have the go-ahead to post." (CN-FR-03)
4. Silence: leave one fully passing draft unreviewed for 48 hours. Expect "No objection from {brand} in 48 hours, so this draft is approved". Start it early in the week; it cannot be hurried from the app.

## Path D: when the live check can't decide

1. If step 8 ended in "We couldn't check {what} automatically.": brand opens the review link, "Confirm the post" → "Confirm? Your $150.00 is taken and {creator} is paid." Expect step 9. (PP-FR-14, PP-FR-27)
2. On another post: leave the brief's link out of the description. Expect "1 items to fix on your live post. Fix them and check again before {time}." Add the link, "Check again", expect it to pass. (PP-FR-12)

## Every page, once

- At 375 px: no sideways scroll, the action in the bar at the bottom, nothing under 44 px.
- On desktop: the checklist is a grid; at 375 px it is cards, showing the same things.
- Fold the rail with `[`; reload; it stays folded.

## Log

| # | Step | What happened | Expected | FR | Who | Fixed in |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | | | | | |

Run on: (date, local or hosted, commit)
