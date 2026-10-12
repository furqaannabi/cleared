-- AlterTable
ALTER TABLE "DraftCheck" ADD COLUMN     "firstCheckPassed" BOOLEAN;

-- A post checked exactly once before this was recorded still shows that first check's results, so
-- whether it passed every item can be worked out: every item passed, or waits for the live check.
-- A post checked more than once keeps only its latest results, and is left unknown (AH-FR-09).
UPDATE "DraftCheck" AS d
SET "firstCheckPassed" = NOT EXISTS (
  SELECT 1 FROM "CheckItem" AS c
  WHERE c."deliverableId" = d."deliverableId" AND c."result" NOT IN ('passed', 'at_live_check')
)
WHERE d."run" = 1 AND d."phase" = 'done';
