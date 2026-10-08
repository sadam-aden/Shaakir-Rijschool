-- Final guard against double-booking (checkSlot in src/lib/domain is the friendly first line of defence).
-- Only "active" lessons count: PLANNED and COMPLETED. AI drafts, cancellations and no-shows never block a slot.
-- Theory group lessons (theoryGroupId set) are excluded: many students share one instructor slot.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Lesson"
  ADD CONSTRAINT lesson_no_instructor_overlap
  EXCLUDE USING gist (
    "instructorId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('PLANNED', 'COMPLETED') AND "theoryGroupId" IS NULL);

ALTER TABLE "Lesson"
  ADD CONSTRAINT lesson_no_vehicle_overlap
  EXCLUDE USING gist (
    "vehicleId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" IN ('PLANNED', 'COMPLETED') AND "vehicleId" IS NOT NULL);

ALTER TABLE "Lesson"
  ADD CONSTRAINT lesson_ends_after_start CHECK ("endsAt" > "startsAt");

-- Hours ledger is append-only: block UPDATE and DELETE at the database level.
-- Exception: the GDPR erasure flow sets app.allow_ledger_delete = 'on' inside its transaction.
CREATE OR REPLACE FUNCTION ledger_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('app.allow_ledger_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'HoursLedgerEntry is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hours_ledger_no_update
  BEFORE UPDATE OR DELETE ON "HoursLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_append_only();
