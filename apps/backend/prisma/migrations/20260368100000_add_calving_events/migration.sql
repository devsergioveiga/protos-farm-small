-- CreateEnum
CREATE TYPE "CalvingEventType" AS ENUM ('BIRTH', 'ABORTION');

-- CreateEnum
CREATE TYPE "BirthType" AS ENUM ('NORMAL', 'ASSISTED_EASY', 'ASSISTED_DIFFICULT', 'CESAREAN');

-- CreateEnum
CREATE TYPE "CalfCondition" AS ENUM ('ALIVE', 'STILLBORN');

-- CreateEnum
CREATE TYPE "AbortionCause" AS ENUM ('INFECTIOUS', 'TRAUMATIC', 'NUTRITIONAL', 'UNKNOWN', 'OTHER');

-- CreateTable
CREATE TABLE "calving_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "motherId" TEXT NOT NULL,
    "fatherId" TEXT,
    "fatherBreedName" TEXT,
    "eventType" "CalvingEventType" NOT NULL,
    "eventDate" DATE NOT NULL,
    "eventTime" TEXT,
    "eventPeriod" TEXT,
    "birthType" "BirthType",
    "presentation" TEXT,
    "abortionGestationDays" INTEGER,
    "abortionCause" "AbortionCause",
    "abortionCauseDetail" TEXT,
    "fetusFound" BOOLEAN,
    "motherWeightKg" DOUBLE PRECISION,
    "placentaRetention" BOOLEAN NOT NULL DEFAULT false,
    "retentionHours" INTEGER,
    "retentionIntervention" BOOLEAN NOT NULL DEFAULT false,
    "pregnancyDiagnosisId" TEXT,
    "attendantName" TEXT NOT NULL,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calving_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calving_calves" (
    "id" TEXT NOT NULL,
    "calvingEventId" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "birthWeightKg" DOUBLE PRECISION,
    "condition" "CalfCondition" NOT NULL,
    "stillbornReason" TEXT,
    "createdAnimalId" TEXT,
    "earTag" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calving_calves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calving_events_organizationId_idx" ON "calving_events"("organizationId");

-- CreateIndex
CREATE INDEX "calving_events_farmId_idx" ON "calving_events"("farmId");

-- CreateIndex
CREATE INDEX "calving_events_motherId_idx" ON "calving_events"("motherId");

-- CreateIndex
CREATE INDEX "calving_events_eventDate_idx" ON "calving_events"("eventDate");

-- CreateIndex
CREATE INDEX "calving_events_eventType_idx" ON "calving_events"("eventType");

-- CreateIndex
CREATE INDEX "calving_calves_calvingEventId_idx" ON "calving_calves"("calvingEventId");

-- CreateIndex
CREATE UNIQUE INDEX "calving_calves_createdAnimalId_key" ON "calving_calves"("createdAnimalId");

-- AddForeignKey
ALTER TABLE "calving_events" ADD CONSTRAINT "calving_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_events" ADD CONSTRAINT "calving_events_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_events" ADD CONSTRAINT "calving_events_motherId_fkey" FOREIGN KEY ("motherId") REFERENCES "animals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_events" ADD CONSTRAINT "calving_events_fatherId_fkey" FOREIGN KEY ("fatherId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_events" ADD CONSTRAINT "calving_events_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_calves" ADD CONSTRAINT "calving_calves_calvingEventId_fkey" FOREIGN KEY ("calvingEventId") REFERENCES "calving_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calving_calves" ADD CONSTRAINT "calving_calves_createdAnimalId_fkey" FOREIGN KEY ("createdAnimalId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enable RLS
ALTER TABLE "calving_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "calving_calves" ENABLE ROW LEVEL SECURITY;

-- RLS policies for calving_events
CREATE POLICY "calving_events_org_isolation" ON "calving_events"
  USING ("organizationId" = current_setting('app.current_org_id', true));

-- RLS policies for calving_calves (via join to calving_events)
CREATE POLICY "calving_calves_org_isolation" ON "calving_calves"
  USING (
    EXISTS (
      SELECT 1 FROM "calving_events" ce
      WHERE ce."id" = "calvingEventId"
        AND ce."organizationId" = current_setting('app.current_org_id', true)
    )
  );
