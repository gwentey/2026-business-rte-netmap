-- CreateTable
CREATE TABLE "OrganizationEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "country" TEXT,
    "address" TEXT,
    "typeHint" TEXT,
    "notes" TEXT,
    "seedVersion" INTEGER NOT NULL DEFAULT 0,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationEntry_organizationName_key" ON "OrganizationEntry"("organizationName");

-- CreateIndex
CREATE INDEX "OrganizationEntry_country_idx" ON "OrganizationEntry"("country");

-- CreateIndex
CREATE INDEX "OrganizationEntry_seedVersion_idx" ON "OrganizationEntry"("seedVersion");
