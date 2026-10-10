# Drafts are uploaded through the API to a private S3 bucket

**Date:** 2026-10-09
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
The draft check needs the creator's video somewhere Amazon Bedrock Data Automation and the Bedrock video model can read it, and both read from S3. So a real bucket is needed even while the API runs on a laptop. No bucket exists, infrastructure as code is undecided, and the agent may not create AWS resources.

## Options
1. **A real bucket, and the browser uploads straight to S3.** The API hands out a short-lived address and large files never pass through it. Needs the bucket's cross-origin rules set to the app's address.
2. **A real bucket, and the file goes through the API.** The browser sends the file to the API, which streams it to S3. No cross-origin rules and one fewer moving part in the page. Every upload ties up the single backend container, and a dropped connection means starting again.
3. **Decide infrastructure as code first.** Create the bucket from code from the start. Cleanest record, but a separate decision and set-up job that delays the draft check.

## Decision
Option 2. Furqaan creates the bucket by hand; infrastructure as code stays undecided until the deployment spec.

## Consequences
- The bucket is private, with public access blocked and encryption on. Furqaan creates it and puts its name in the service's settings.
- The upload route is the one changing route whose body is not JSON. It still requires the app's origin and a creator session, and cuts the file off at the size limit as it arrives.
- The API streams the file to S3 and never holds it whole in memory.
- Risk accepted: a 1 GB upload occupies the one container for as long as it takes, and cannot be resumed. To be tried from a home connection while building.
- Storage sits behind a port. Moving to a direct upload later is one adapter and one change to the page.
- The backend gains AWS's S3 client, its streaming upload and its address signer.
