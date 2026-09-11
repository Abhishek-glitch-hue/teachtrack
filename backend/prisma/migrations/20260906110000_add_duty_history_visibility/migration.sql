-- A teacher can hide a duty from their own history without changing the duty.
ALTER TABLE "Duty"
ADD COLUMN "hiddenFromTeacher" BOOLEAN NOT NULL DEFAULT false;
