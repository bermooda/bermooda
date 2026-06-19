-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "consentJson" TEXT;
ALTER TABLE "Customer" ADD COLUMN "erasedAt" DATETIME;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "diffJson" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduledExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "filtersJson" TEXT,
    "schedule" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "lastRunAt" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExportRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduledExportId" TEXT,
    "exportType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "fileContent" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "ExportRun_scheduledExportId_fkey" FOREIGN KEY ("scheduledExportId") REFERENCES "ScheduledExport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "ExportRun_scheduledExportId_idx" ON "ExportRun"("scheduledExportId");

-- CreateIndex
CREATE INDEX "ExportRun_status_idx" ON "ExportRun"("status");

-- CreateIndex
CREATE INDEX "ExportRun_createdAt_idx" ON "ExportRun"("createdAt");
