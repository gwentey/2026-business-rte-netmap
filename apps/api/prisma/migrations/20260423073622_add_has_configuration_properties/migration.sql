-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Import" (
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
    "hasConfigurationProperties" BOOLEAN NOT NULL DEFAULT false,
    "warningsJson" TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO "new_Import" ("dumpType", "effectiveDate", "envName", "fileHash", "fileName", "id", "label", "sourceComponentEic", "sourceDumpTimestamp", "uploadedAt", "warningsJson", "zipPath") SELECT "dumpType", "effectiveDate", "envName", "fileHash", "fileName", "id", "label", "sourceComponentEic", "sourceDumpTimestamp", "uploadedAt", "warningsJson", "zipPath" FROM "Import";
DROP TABLE "Import";
ALTER TABLE "new_Import" RENAME TO "Import";
CREATE INDEX "Import_envName_effectiveDate_idx" ON "Import"("envName", "effectiveDate");
CREATE INDEX "Import_fileHash_idx" ON "Import"("fileHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
