-- CreateTable
CREATE TABLE "team_operations" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "fieldPlotId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "operationType" "FieldOperationType" NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "timeStart" TIMESTAMP(3) NOT NULL,
    "timeEnd" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "photoUrl" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "recordedBy" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_operation_entries" (
    "id" TEXT NOT NULL,
    "teamOperationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hoursWorked" DECIMAL(6,2),
    "productivity" DECIMAL(12,4),
    "productivityUnit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_operation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_operations_farmId_idx" ON "team_operations"("farmId");
CREATE INDEX "team_operations_teamId_idx" ON "team_operations"("teamId");
CREATE INDEX "team_operations_fieldPlotId_idx" ON "team_operations"("fieldPlotId");
CREATE INDEX "team_operations_performedAt_idx" ON "team_operations"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "team_operation_entries_teamOperationId_userId_key" ON "team_operation_entries"("teamOperationId", "userId");
CREATE INDEX "team_operation_entries_teamOperationId_idx" ON "team_operation_entries"("teamOperationId");
CREATE INDEX "team_operation_entries_userId_idx" ON "team_operation_entries"("userId");

-- AddForeignKey
ALTER TABLE "team_operations" ADD CONSTRAINT "team_operations_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_operations" ADD CONSTRAINT "team_operations_fieldPlotId_fkey" FOREIGN KEY ("fieldPlotId") REFERENCES "field_plots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_operations" ADD CONSTRAINT "team_operations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "field_teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "team_operations" ADD CONSTRAINT "team_operations_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_operation_entries" ADD CONSTRAINT "team_operation_entries_teamOperationId_fkey" FOREIGN KEY ("teamOperationId") REFERENCES "team_operations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_operation_entries" ADD CONSTRAINT "team_operation_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
