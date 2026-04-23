-- CreateTable
CREATE TABLE "ImportedDirectorySync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "directoryCode" TEXT NOT NULL,
    "directorySyncMode" TEXT NOT NULL,
    "directoryType" TEXT,
    "directoryUrl" TEXT,
    "synchronizationStatus" TEXT,
    "synchronizationTimestamp" DATETIME,
    CONSTRAINT "ImportedDirectorySync_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ImportedDirectorySync_importId_idx" ON "ImportedDirectorySync"("importId");

-- CreateIndex
CREATE INDEX "ImportedDirectorySync_directoryCode_idx" ON "ImportedDirectorySync"("directoryCode");
