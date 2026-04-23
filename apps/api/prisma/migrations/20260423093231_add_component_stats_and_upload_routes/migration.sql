-- CreateTable
CREATE TABLE "ImportedComponentStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "componentCode" TEXT NOT NULL,
    "lastSyncSucceed" BOOLEAN,
    "lastSynchronizedTime" DATETIME,
    "modifiedDate" DATETIME,
    "receivedMessages" INTEGER NOT NULL DEFAULT 0,
    "sentMessages" INTEGER NOT NULL DEFAULT 0,
    "waitingToDeliverMessages" INTEGER NOT NULL DEFAULT 0,
    "waitingToReceiveMessages" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ImportedComponentStat_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedUploadRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "targetComponentCode" TEXT NOT NULL,
    "createdDate" DATETIME,
    CONSTRAINT "ImportedUploadRoute_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportedComponentStat_importId_idx" ON "ImportedComponentStat"("importId");

-- CreateIndex
CREATE INDEX "ImportedComponentStat_componentCode_idx" ON "ImportedComponentStat"("componentCode");

-- CreateIndex
CREATE INDEX "ImportedUploadRoute_importId_idx" ON "ImportedUploadRoute"("importId");

-- CreateIndex
CREATE INDEX "ImportedUploadRoute_targetComponentCode_idx" ON "ImportedUploadRoute"("targetComponentCode");
