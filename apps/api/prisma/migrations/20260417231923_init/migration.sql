-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "envName" TEXT NOT NULL,
    "componentType" TEXT NOT NULL,
    "sourceComponentCode" TEXT NOT NULL,
    "cdCode" TEXT,
    "organization" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "zipPath" TEXT NOT NULL,
    "warningsJson" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "eic" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "personName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "homeCdCode" TEXT,
    "networksCsv" TEXT NOT NULL,
    "creationTs" DATETIME,
    "modificationTs" DATETIME,
    "displayName" TEXT NOT NULL,
    "country" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "isDefaultPosition" BOOLEAN NOT NULL DEFAULT false,
    "process" TEXT,
    "sourceType" TEXT NOT NULL,
    CONSTRAINT "Component_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentUrl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "componentId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "ComponentUrl_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagePath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "receiverEic" TEXT NOT NULL,
    "senderEicOrWildcard" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "transportPattern" TEXT NOT NULL,
    "intermediateBrokerEic" TEXT,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "process" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MessagePath_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagingStatistic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "sourceEndpointCode" TEXT NOT NULL,
    "remoteComponentCode" TEXT NOT NULL,
    "connectionStatus" TEXT,
    "lastMessageUp" DATETIME,
    "lastMessageDown" DATETIME,
    "sumMessagesUp" INTEGER NOT NULL DEFAULT 0,
    "sumMessagesDown" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MessagingStatistic_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "AppProperty_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Snapshot_envName_idx" ON "Snapshot"("envName");

-- CreateIndex
CREATE INDEX "Snapshot_uploadedAt_idx" ON "Snapshot"("uploadedAt");

-- CreateIndex
CREATE INDEX "Component_snapshotId_idx" ON "Component"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "Component_snapshotId_eic_key" ON "Component"("snapshotId", "eic");

-- CreateIndex
CREATE INDEX "ComponentUrl_componentId_idx" ON "ComponentUrl"("componentId");

-- CreateIndex
CREATE INDEX "MessagePath_snapshotId_idx" ON "MessagePath"("snapshotId");

-- CreateIndex
CREATE INDEX "MessagePath_snapshotId_receiverEic_idx" ON "MessagePath"("snapshotId", "receiverEic");

-- CreateIndex
CREATE INDEX "MessagingStatistic_snapshotId_idx" ON "MessagingStatistic"("snapshotId");

-- CreateIndex
CREATE INDEX "MessagingStatistic_snapshotId_remoteComponentCode_idx" ON "MessagingStatistic"("snapshotId", "remoteComponentCode");

-- CreateIndex
CREATE INDEX "AppProperty_snapshotId_idx" ON "AppProperty"("snapshotId");
