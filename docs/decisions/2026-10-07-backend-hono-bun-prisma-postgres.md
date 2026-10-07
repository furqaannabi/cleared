# Backend is one Hono service on Bun, with Prisma and Postgres, not Lambda

**Date:** 2026-10-07
**Status:** Accepted
**Decided by:** Furqaan
**Supersedes:** none

## Context
`docs/PRODUCT.md` set the backend as Lambda behind API Gateway, with Step Functions and EventBridge Scheduler for the draft check pipeline and the timers, and DynamoDB for data. No backend code exists yet, and the Lambda language, infrastructure as code and backend test tooling were still undecided. Furqaan leads the backend and chose a different shape before the first backend spec is written.

## Options
How much moves off Lambda:

1. **Everything in one Bun service.** The API, the draft check pipeline and all timers run in one service, with jobs and timers kept in a Postgres-backed queue. One codebase and one deploy. Timers only fire while the service is running.
2. **API and pipeline in the service; EventBridge Scheduler keeps the timers.** A timer survives the service being down and calls an API endpoint when it fires. One AWS piece left to wire and secure.
3. **API only.** Hono replaces Lambda behind API Gateway; Step Functions and EventBridge Scheduler stay and call the API over HTTP. Least change to PRODUCT.md, but two systems to build and debug.

Where the service and Postgres run:

1. **Render.** A hackathon sponsor tool, fastest to deploy, and adds eligibility for Render's prize. Needs AWS access keys stored as secrets to reach Bedrock and S3.
2. **AWS: ECS Fargate and RDS.** Stays all-AWS and reaches Bedrock, S3 and KMS through a role with no stored keys. More setup and a higher fixed monthly cost.
3. **Decide later.**

## Decision
The whole backend is one service written in TypeScript with Hono, running on Bun. It reads and writes PostgreSQL through Prisma and describes its API with OpenAPI. It runs in a container on Amazon ECS Fargate, with PostgreSQL on Amazon RDS. Lambda, API Gateway, Step Functions, EventBridge Scheduler and DynamoDB are not used.

## Consequences
- **What stays:** S3 for files, KMS for encryption, Cognito for sign-in, and Amazon Bedrock for every AI check. The service calls them through the AWS SDK. Product behaviour in PRODUCT.md is unchanged.
- **Timers and the pipeline become jobs in Postgres.** The 48-hour review window, the deadline release, the draft check and the live check are rows in a job queue the service works through. A job that falls due while the service is down runs late when it comes back; it is not lost. Which queue library is not chosen yet.
- **Money jobs must be safe to run twice.** A job can be retried after a crash, so every hold, capture, release and payout job sends a `PayPal-Request-Id` and checks the recorded money state first. `CLAUDE.md` already requires the request id.
- **Money state still changes only in fixed code.** That code is now the service's routes and job handlers, not Step Functions or Lambda. `CLAUDE.md`'s Money rule is reworded to say so.
- **The service runs all the time.** Fargate, RDS and a load balancer have a fixed monthly cost through the end of judging on 15 December, where Lambda and DynamoDB would have cost close to nothing when idle.
- **No stored AWS keys.** The service reaches Bedrock, S3 and KMS through its task role. The database is not reachable from the public internet, and its credentials are a server-side secret under the existing Secrets rule.
- **OpenAPI is Furqaan's choice for the API contract's format.** The contract is a joint decision, so William needs to agree before it is recorded as settled. How the OpenAPI document is produced, and how `web/`'s Zod schemas and types are generated from it, is part of that decision.
- **`backend/` is TypeScript, so it joins the pnpm workspace**, as the [repo layout record](2026-10-06-repo-layout-and-package-manager.md) says a TypeScript backend does. That record assumed Lambda's Node runtime; Bun is now the backend's runtime. `.nvmrc` keeps pinning Node for `web/` and no longer has a Lambda runtime to match.
- **Still undecided, owned by Furqaan:** the job queue library, infrastructure as code and backend test tooling. "Language for Lambdas" is closed by this record.
- **Docs updated:** the "Built with" table and the "Runs on" column in `docs/PRODUCT.md`, and the stack, layout and Money rule in `CLAUDE.md`.
- **No spec is affected yet.** `docs/specs/creator-draft-check-frd.md` asks for endpoints and fields, not for how they are served.
