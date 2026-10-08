-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('nl', 'en');

-- CreateEnum
CREATE TYPE "Gearbox" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "StudentTrack" AS ENUM ('PRACTICAL', 'THEORY_ONLY', 'BOTH');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('WAITING_LIST', 'ACTIVE', 'PAUSED', 'PASSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DayPart" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('PRACTICAL', 'THEORY', 'EXAM_BUNDLE');

-- CreateEnum
CREATE TYPE "StudentPackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('PURCHASE', 'RESERVE', 'RELEASE', 'CONSUME', 'ADJUST', 'REFUND');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('PRACTICAL', 'THEORY', 'EXAM');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'PLANNED', 'COMPLETED', 'NO_SHOW', 'CANCELLED_STUDENT', 'CANCELLED_SCHOOL');

-- CreateEnum
CREATE TYPE "LessonSource" AS ENUM ('MANUAL', 'AI', 'RECURRING');

-- CreateEnum
CREATE TYPE "Attendance" AS ENUM ('ENROLLED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ExamKind" AS ENUM ('THEORY', 'PRACTICAL', 'TUSSENTIJDSE_TOETS');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Readiness" AS ENUM ('READY', 'NEEDS_LESSONS');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'IN_MAINTENANCE', 'RETIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('IDEAL', 'BANK_TRANSFER', 'CASH', 'PIN');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'DISCARDED', 'PARTIALLY_APPROVED');

-- CreateEnum
CREATE TYPE "DraftItemOutcome" AS ENUM ('KEPT', 'MOVED', 'REMOVED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "postcode" TEXT,
    "city" TEXT,
    "kvk" TEXT,
    "btw" TEXT,
    "iban" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
    "logoUrl" TEXT,
    "defaultLocale" "Locale" NOT NULL DEFAULT 'nl',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'INSTRUCTOR',
    "locale" "Locale" NOT NULL DEFAULT 'nl',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailVerified" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invite" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'INSTRUCTOR',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "acceptedAt" TIMESTAMPTZ,
    "invitedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Instructor" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#1D4ED8',
    "licenceNumber" TEXT,
    "maxMinutesPerDay" INTEGER NOT NULL DEFAULT 480,
    "homeAddress" TEXT,
    "homeLat" DOUBLE PRECISION,
    "homeLng" DOUBLE PRECISION,
    "defaultVehicleId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Instructor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorWorkingHours" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,

    CONSTRAINT "InstructorWorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorTimeOff" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,

    CONSTRAINT "InstructorTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "birthDate" DATE,
    "address" TEXT,
    "postcode" TEXT,
    "area" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "gearbox" "Gearbox" NOT NULL DEFAULT 'MANUAL',
    "track" "StudentTrack" NOT NULL DEFAULT 'PRACTICAL',
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "primaryInstructorId" TEXT,
    "since" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "smsConsent" BOOLEAN NOT NULL DEFAULT false,
    "emailConsent" BOOLEAN NOT NULL DEFAULT false,
    "locale" "Locale" NOT NULL DEFAULT 'nl',
    "cbrCandidateNumber" TEXT,
    "avatarColor" TEXT NOT NULL DEFAULT '#DBEAFE',
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "minutesRemaining" INTEGER NOT NULL DEFAULT 0,
    "minutesReserved" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAvailability" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "part" "DayPart" NOT NULL,
    "startMin" INTEGER,
    "endMin" INTEGER,

    CONSTRAINT "StudentAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentUnavailability" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,

    CONSTRAINT "StudentUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "nameNl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionNl" TEXT,
    "descriptionEn" TEXT,
    "type" "PackageType" NOT NULL,
    "lessonCount" INTEGER NOT NULL,
    "minutesIncluded" INTEGER NOT NULL,
    "includesExam" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 21,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPackage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "priceCents" INTEGER NOT NULL,
    "minutesPurchased" INTEGER NOT NULL,
    "examCredits" INTEGER NOT NULL DEFAULT 0,
    "status" "StudentPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "invoiceId" TEXT,

    CONSTRAINT "StudentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HoursLedgerEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentPackageId" TEXT,
    "lessonId" TEXT,
    "type" "LedgerType" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoursLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurrenceRule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "count" INTEGER,
    "until" TIMESTAMPTZ,

    CONSTRAINT "RecurrenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "LessonType" NOT NULL,
    "instructorId" TEXT NOT NULL,
    "studentId" TEXT,
    "theoryGroupId" TEXT,
    "vehicleId" TEXT,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "gearbox" "Gearbox",
    "pickupAddress" TEXT,
    "pickupLat" DOUBLE PRECISION,
    "pickupLng" DOUBLE PRECISION,
    "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
    "cancellationReason" TEXT,
    "chargeable" BOOLEAN NOT NULL DEFAULT true,
    "source" "LessonSource" NOT NULL DEFAULT 'MANUAL',
    "scheduleDraftId" TEXT,
    "recurrenceRuleId" TEXT,
    "instructorNotes" TEXT,
    "studentNotes" TEXT,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheoryGroup" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "titleNl" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "topic" TEXT,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "location" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "instructorId" TEXT NOT NULL,

    CONSTRAINT "TheoryGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheoryEnrollment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "theoryGroupId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attendance" "Attendance" NOT NULL DEFAULT 'ENROLLED',

    CONSTRAINT "TheoryEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "ExamKind" NOT NULL,
    "scheduledAt" TIMESTAMPTZ,
    "cbrLocation" TEXT,
    "lessonId" TEXT,
    "status" "ExamStatus" NOT NULL DEFAULT 'REQUESTED',
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "readiness" "Readiness" NOT NULL DEFAULT 'NEEDS_LESSONS',
    "lessonsLeftEstimate" INTEGER,
    "notes" TEXT,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nameNl" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "isCore" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillProgress" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SkillProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillAssessment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "lessonId" TEXT,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "gearbox" "Gearbox" NOT NULL,
    "color" TEXT,
    "dualControl" BOOLEAN NOT NULL DEFAULT true,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "apkDueDate" DATE,
    "nextServiceDate" DATE,
    "insuranceDueDate" DATE,
    "odometerKm" INTEGER,
    "assignedInstructorId" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleUnavailability" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,

    CONSTRAINT "VehicleUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "schoolId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("schoolId","year")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "lines" JSONB NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATE NOT NULL,
    "pdfUrl" TEXT,
    "locale" "Locale" NOT NULL DEFAULT 'nl',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "molliePaymentId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" "NotificationChannel" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDraft" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "instructorId" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "explanation" TEXT,
    "generatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ,

    CONSTRAINT "ScheduleDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDraftItem" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "scheduleDraftId" TEXT NOT NULL,
    "lessonId" TEXT,
    "originalStartsAt" TIMESTAMPTZ NOT NULL,
    "originalEndsAt" TIMESTAMPTZ NOT NULL,
    "outcome" "DraftItemOutcome" NOT NULL DEFAULT 'KEPT',

    CONSTRAINT "ScheduleDraftItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "locale" "Locale" NOT NULL DEFAULT 'nl',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "scheduledFor" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ,
    "error" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InAppNotification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "href" TEXT,
    "readAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_schoolId_idx" ON "User"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_schoolId_idx" ON "Invite"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Instructor_userId_key" ON "Instructor"("userId");

-- CreateIndex
CREATE INDEX "Instructor_schoolId_idx" ON "Instructor"("schoolId");

-- CreateIndex
CREATE INDEX "InstructorWorkingHours_schoolId_idx" ON "InstructorWorkingHours"("schoolId");

-- CreateIndex
CREATE INDEX "InstructorWorkingHours_instructorId_weekday_idx" ON "InstructorWorkingHours"("instructorId", "weekday");

-- CreateIndex
CREATE INDEX "InstructorTimeOff_schoolId_idx" ON "InstructorTimeOff"("schoolId");

-- CreateIndex
CREATE INDEX "InstructorTimeOff_instructorId_startsAt_idx" ON "InstructorTimeOff"("instructorId", "startsAt");

-- CreateIndex
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Student_schoolId_lastName_idx" ON "Student"("schoolId", "lastName");

-- CreateIndex
CREATE INDEX "StudentAvailability_schoolId_idx" ON "StudentAvailability"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAvailability_studentId_weekday_part_key" ON "StudentAvailability"("studentId", "weekday", "part");

-- CreateIndex
CREATE INDEX "StudentUnavailability_schoolId_idx" ON "StudentUnavailability"("schoolId");

-- CreateIndex
CREATE INDEX "StudentUnavailability_studentId_startsAt_idx" ON "StudentUnavailability"("studentId", "startsAt");

-- CreateIndex
CREATE INDEX "Package_schoolId_idx" ON "Package"("schoolId");

-- CreateIndex
CREATE INDEX "StudentPackage_schoolId_idx" ON "StudentPackage"("schoolId");

-- CreateIndex
CREATE INDEX "StudentPackage_studentId_idx" ON "StudentPackage"("studentId");

-- CreateIndex
CREATE INDEX "HoursLedgerEntry_schoolId_idx" ON "HoursLedgerEntry"("schoolId");

-- CreateIndex
CREATE INDEX "HoursLedgerEntry_studentId_createdAt_idx" ON "HoursLedgerEntry"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "HoursLedgerEntry_lessonId_idx" ON "HoursLedgerEntry"("lessonId");

-- CreateIndex
CREATE INDEX "RecurrenceRule_schoolId_idx" ON "RecurrenceRule"("schoolId");

-- CreateIndex
CREATE INDEX "Lesson_schoolId_startsAt_idx" ON "Lesson"("schoolId", "startsAt");

-- CreateIndex
CREATE INDEX "Lesson_instructorId_startsAt_idx" ON "Lesson"("instructorId", "startsAt");

-- CreateIndex
CREATE INDEX "Lesson_studentId_startsAt_idx" ON "Lesson"("studentId", "startsAt");

-- CreateIndex
CREATE INDEX "Lesson_vehicleId_startsAt_idx" ON "Lesson"("vehicleId", "startsAt");

-- CreateIndex
CREATE INDEX "TheoryGroup_schoolId_startsAt_idx" ON "TheoryGroup"("schoolId", "startsAt");

-- CreateIndex
CREATE INDEX "TheoryEnrollment_schoolId_idx" ON "TheoryEnrollment"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "TheoryEnrollment_theoryGroupId_studentId_key" ON "TheoryEnrollment"("theoryGroupId", "studentId");

-- CreateIndex
CREATE INDEX "Exam_schoolId_scheduledAt_idx" ON "Exam"("schoolId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Exam_studentId_idx" ON "Exam"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_schoolId_key_key" ON "Skill"("schoolId", "key");

-- CreateIndex
CREATE INDEX "SkillProgress_schoolId_idx" ON "SkillProgress"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProgress_studentId_skillId_key" ON "SkillProgress"("studentId", "skillId");

-- CreateIndex
CREATE INDEX "SkillAssessment_schoolId_idx" ON "SkillAssessment"("schoolId");

-- CreateIndex
CREATE INDEX "SkillAssessment_studentId_createdAt_idx" ON "SkillAssessment"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Vehicle_schoolId_idx" ON "Vehicle"("schoolId");

-- CreateIndex
CREATE INDEX "VehicleUnavailability_schoolId_idx" ON "VehicleUnavailability"("schoolId");

-- CreateIndex
CREATE INDEX "VehicleUnavailability_vehicleId_startsAt_idx" ON "VehicleUnavailability"("vehicleId", "startsAt");

-- CreateIndex
CREATE INDEX "Invoice_schoolId_status_idx" ON "Invoice"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Invoice_studentId_idx" ON "Invoice"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_schoolId_number_key" ON "Invoice"("schoolId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_molliePaymentId_key" ON "Payment"("molliePaymentId");

-- CreateIndex
CREATE INDEX "Payment_schoolId_paidAt_idx" ON "Payment"("schoolId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentReminder_schoolId_idx" ON "PaymentReminder"("schoolId");

-- CreateIndex
CREATE INDEX "PaymentReminder_invoiceId_idx" ON "PaymentReminder"("invoiceId");

-- CreateIndex
CREATE INDEX "ScheduleDraft_schoolId_date_idx" ON "ScheduleDraft"("schoolId", "date");

-- CreateIndex
CREATE INDEX "ScheduleDraft_instructorId_date_idx" ON "ScheduleDraft"("instructorId", "date");

-- CreateIndex
CREATE INDEX "ScheduleDraftItem_schoolId_idx" ON "ScheduleDraftItem"("schoolId");

-- CreateIndex
CREATE INDEX "ScheduleDraftItem_scheduleDraftId_idx" ON "ScheduleDraftItem"("scheduleDraftId");

-- CreateIndex
CREATE INDEX "Notification_schoolId_status_scheduledFor_idx" ON "Notification"("schoolId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "InAppNotification_schoolId_idx" ON "InAppNotification"("schoolId");

-- CreateIndex
CREATE INDEX "InAppNotification_userId_readAt_idx" ON "InAppNotification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instructor" ADD CONSTRAINT "Instructor_defaultVehicleId_fkey" FOREIGN KEY ("defaultVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorWorkingHours" ADD CONSTRAINT "InstructorWorkingHours_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorTimeOff" ADD CONSTRAINT "InstructorTimeOff_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_primaryInstructorId_fkey" FOREIGN KEY ("primaryInstructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvailability" ADD CONSTRAINT "StudentAvailability_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentUnavailability" ADD CONSTRAINT "StudentUnavailability_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursLedgerEntry" ADD CONSTRAINT "HoursLedgerEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursLedgerEntry" ADD CONSTRAINT "HoursLedgerEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursLedgerEntry" ADD CONSTRAINT "HoursLedgerEntry_studentPackageId_fkey" FOREIGN KEY ("studentPackageId") REFERENCES "StudentPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HoursLedgerEntry" ADD CONSTRAINT "HoursLedgerEntry_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_theoryGroupId_fkey" FOREIGN KEY ("theoryGroupId") REFERENCES "TheoryGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_scheduleDraftId_fkey" FOREIGN KEY ("scheduleDraftId") REFERENCES "ScheduleDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_recurrenceRuleId_fkey" FOREIGN KEY ("recurrenceRuleId") REFERENCES "RecurrenceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryGroup" ADD CONSTRAINT "TheoryGroup_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryGroup" ADD CONSTRAINT "TheoryGroup_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryEnrollment" ADD CONSTRAINT "TheoryEnrollment_theoryGroupId_fkey" FOREIGN KEY ("theoryGroupId") REFERENCES "TheoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheoryEnrollment" ADD CONSTRAINT "TheoryEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProgress" ADD CONSTRAINT "SkillProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillProgress" ADD CONSTRAINT "SkillProgress_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAssessment" ADD CONSTRAINT "SkillAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAssessment" ADD CONSTRAINT "SkillAssessment_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillAssessment" ADD CONSTRAINT "SkillAssessment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_assignedInstructorId_fkey" FOREIGN KEY ("assignedInstructorId") REFERENCES "Instructor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleUnavailability" ADD CONSTRAINT "VehicleUnavailability_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraft" ADD CONSTRAINT "ScheduleDraft_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraft" ADD CONSTRAINT "ScheduleDraft_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraftItem" ADD CONSTRAINT "ScheduleDraftItem_scheduleDraftId_fkey" FOREIGN KEY ("scheduleDraftId") REFERENCES "ScheduleDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraftItem" ADD CONSTRAINT "ScheduleDraftItem_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InAppNotification" ADD CONSTRAINT "InAppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

