# Repo layout: pnpm workspace with web/, backend/ and contract/

**Date:** 2026-10-06
**Status:** Accepted
**Decided by:** William
**Supersedes:** none

## Context
The package manager, monorepo layout and shared code need both William and Furqaan. The frontend has a signed spec (`docs/specs/creator-draft-check-frd.md`) and is ready to start, and `web/` cannot be scaffolded until the layout is set. William decided so the frontend can start; Furqaan reviews it, and either can supersede it with a new record. The Lambda language is not chosen yet, so the layout must work whether the backend is TypeScript or not. The API contract's format is a separate joint decision.

## Options
1. **pnpm workspace with `web/`, `backend/` and `contract/`.** The contract has one home both sides read, and `web/` imports types generated from it. Works with any backend language: a TypeScript backend joins the workspace, any other keeps its own toolchain in `backend/`. Vercel builds `web/` only. Cost: a little workspace setup.
2. **Independent `web/` and `backend/` folders, no workspace.** Simplest, nothing shared to agree on. Shared types are copied or generated straight into `web/` and can drift from the backend.
3. **Option 1 plus Turborepo.** Cached builds and tests across packages. Another dev dependency and config for two people and two or three packages; can be added later without moving anything.

Package manager options were pnpm (fast, strict about undeclared dependencies, built-in workspaces, native on Vercel), npm (no install, slower and looser) and Bun (fastest, but edge cases with Next.js and Vercel, and a second JavaScript runtime beside Lambda's Node).

## Decision
Option 1, with pnpm.

## Consequences
- Layout: `web/` (Next.js, William), `backend/` (Lambdas and infrastructure, Furqaan), `contract/` (the API contract and generated TypeScript types), alongside `design/` and `docs/`. A root `pnpm-workspace.yaml`, `package.json` and `.nvmrc` sit at the top.
- `web/` stays self-contained so Vercel can deploy it with `web/` as its root directory. It never imports from `design/` or `backend/`.
- Until the contract exists, the provisional mock shapes live in `web/` and are marked provisional. They move to `contract/` once the contract is agreed.
- `contract/` holds no hand-written backend logic. How types are generated is set by the API contract decision.
- The Node version is pinned in `.nvmrc`, matched to the Lambda runtime once Furqaan chooses it.
- `CLAUDE.md` and `README.md` record the layout.
- Furqaan to review. If he changes it, a new record supersedes this one.
