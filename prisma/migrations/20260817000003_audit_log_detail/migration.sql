-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "actorRole" TEXT,
ADD COLUMN     "detail" TEXT,
ADD COLUMN     "entity" TEXT,
ADD COLUMN     "entityId" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

