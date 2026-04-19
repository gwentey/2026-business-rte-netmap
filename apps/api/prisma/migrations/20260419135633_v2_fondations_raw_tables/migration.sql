/*
  Warnings:

  - You are about to drop the `AppProperty` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Component` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ComponentUrl` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessagePath` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MessagingStatistic` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Snapshot` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AppProperty";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Component";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ComponentUrl";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MessagePath";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MessagingStatistic";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Snapshot";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "envName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "sourceComponentEic" TEXT,
    "sourceDumpTimestamp" DATETIME,
    "dumpType" TEXT NOT NULL,
    "zipPath" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveDate" DATETIME NOT NULL,
    "warningsJson" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "ImportedComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "eic" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "organization" TEXT,
    "personName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "homeCdCode" TEXT,
    "networksCsv" TEXT,
    "displayName" TEXT,
    "country" TEXT,
    "lat" REAL,
    "lng" REAL,
    "isDefaultPosition" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT NOT NULL,
    "creationTs" DATETIME,
    "modificationTs" DATETIME,
    CONSTRAINT "ImportedComponent_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedComponentUrl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importedComponentId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "ImportedComponentUrl_importedComponentId_fkey" FOREIGN KEY ("importedComponentId") REFERENCES "ImportedComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedPath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "receiverEic" TEXT NOT NULL,
    "senderEic" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "transportPattern" TEXT NOT NULL,
    "intermediateBrokerEic" TEXT,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ImportedPath_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedMessagingStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "sourceEndpointCode" TEXT NOT NULL,
    "remoteComponentCode" TEXT NOT NULL,
    "connectionStatus" TEXT,
    "lastMessageUp" DATETIME,
    "lastMessageDown" DATETIME,
    "sumMessagesUp" INTEGER NOT NULL DEFAULT 0,
    "sumMessagesDown" INTEGER NOT NULL DEFAULT 0,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ImportedMessagingStat_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportedAppProperty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "ImportedAppProperty_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComponentOverride" (
    "eic" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT,
    "type" TEXT,
    "organization" TEXT,
    "country" TEXT,
    "lat" REAL,
    "lng" REAL,
    "tagsCsv" TEXT,
    "notes" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EntsoeEntry" (
    "eic" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT,
    "organization" TEXT,
    "country" TEXT,
    "function" TEXT,
    "refreshedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Import_envName_idx" ON "Import"("envName");

-- CreateIndex
CREATE INDEX "Import_envName_effectiveDate_idx" ON "Import"("envName", "effectiveDate");

-- CreateIndex
CREATE INDEX "Import_fileHash_idx" ON "Import"("fileHash");

-- CreateIndex
CREATE INDEX "ImportedComponent_importId_idx" ON "ImportedComponent"("importId");

-- CreateIndex
CREATE INDEX "ImportedComponent_eic_idx" ON "ImportedComponent"("eic");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedComponent_importId_eic_key" ON "ImportedComponent"("importId", "eic");

-- CreateIndex
CREATE INDEX "ImportedComponentUrl_importedComponentId_idx" ON "ImportedComponentUrl"("importedComponentId");

-- CreateIndex
CREATE INDEX "ImportedPath_importId_idx" ON "ImportedPath"("importId");

-- CreateIndex
CREATE INDEX "ImportedPath_receiverEic_senderEic_idx" ON "ImportedPath"("receiverEic", "senderEic");

-- CreateIndex
CREATE INDEX "idx_path_identity" ON "ImportedPath"("receiverEic", "senderEic", "messageType", "transportPattern", "intermediateBrokerEic");

-- CreateIndex
CREATE INDEX "ImportedMessagingStat_importId_idx" ON "ImportedMessagingStat"("importId");

-- CreateIndex
CREATE INDEX "ImportedMessagingStat_importId_remoteComponentCode_idx" ON "ImportedMessagingStat"("importId", "remoteComponentCode");

-- CreateIndex
CREATE INDEX "ImportedAppProperty_importId_idx" ON "ImportedAppProperty"("importId");
