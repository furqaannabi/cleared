-- What a failed job keeps of its error is now the error's name, its code and where it was thrown,
-- never its message (deal set-up spec DS-FR-53). A message stored before this can repeat what the
-- database or PayPal said, so every one is cleared. Nothing reads this column: it is for a person.
UPDATE "Job" SET "lastError" = NULL WHERE "lastError" IS NOT NULL;
