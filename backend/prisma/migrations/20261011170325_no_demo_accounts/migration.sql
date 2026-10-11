-- No demo accounts: every creator signs in with Google
-- (docs/decisions/2026-10-11-no-demo-accounts.md; deal set-up spec DS-FR-07, revision 1.2).
--
-- Demo accounts that exist are deleted with everything they made. Their money is the PayPal
-- sandbox's and is not touched: the money path finishes it on its own timers, releasing any hold.
-- A draft's file in the bucket cannot be reached from here; the bucket's own rule removes it.

-- Jobs that would run for what is about to go. The money path's own jobs are left alone.
DELETE FROM "Job" WHERE "name" = 'demo_cleanup';
DELETE FROM "Job"
  WHERE "name" = 'brand_notice'
    AND "payload"->>'noticeId' IN (
      SELECT n."id" FROM "BrandNotice" n
        JOIN "Deliverable" d ON d."id" = n."deliverableId"
        JOIN "Deal" deal ON deal."id" = d."dealId"
        JOIN "Creator" c ON c."id" = deal."creatorId"
      WHERE c."demo");
DELETE FROM "Job"
  WHERE "name" IN ('check_draft', 'live_check', 'review_window_end')
    AND "payload"->>'deliverableId' IN (
      SELECT d."id" FROM "Deliverable" d
        JOIN "Deal" deal ON deal."id" = d."dealId"
        JOIN "Creator" c ON c."id" = deal."creatorId"
      WHERE c."demo");
DELETE FROM "Job"
  WHERE "name" = 'read_brief'
    AND "payload"->>'dealId' IN (
      SELECT deal."id" FROM "Deal" deal JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");

-- What a demo creator's posts gathered, in the tables that carry only the post's id.
DELETE FROM "CheckItem" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "DraftCheck" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "Draft" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "LiveCheckItem" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "LiveCheck" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "PostVideo" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "BrandNotice" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "PostCancel" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");
DELETE FROM "Ruling" WHERE "deliverableId" IN (SELECT d."id" FROM "Deliverable" d JOIN "Deal" deal ON deal."id" = d."dealId" JOIN "Creator" c ON c."id" = deal."creatorId" WHERE c."demo");

-- The demo creators themselves. Their sessions, connected accounts, deals and each deal's posts,
-- checklist, links, terms and notes go with them.
DELETE FROM "Creator" WHERE "demo";

-- DropIndex
DROP INDEX "Creator_demo_madeFrom_createdAt_idx";

-- AlterTable
ALTER TABLE "Creator" DROP COLUMN "demo",
DROP COLUMN "madeFrom",
ALTER COLUMN "googleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ConnectedAccount" DROP COLUMN "synthetic";
