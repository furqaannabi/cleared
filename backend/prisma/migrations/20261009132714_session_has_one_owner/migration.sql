-- A session is a creator's or a brand's, never both and never neither (deal set-up spec DS-FR-34).
ALTER TABLE "Session" ADD CONSTRAINT "Session_one_owner" CHECK (("creatorId" IS NULL) <> ("linkId" IS NULL));
