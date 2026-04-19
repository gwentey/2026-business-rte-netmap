import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BuiltImport } from './types.js';

const SENSITIVE_FILES = new Set([
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
]);

@Injectable()
export class RawPersisterService {
  private readonly logger = new Logger(RawPersisterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async persist(built: BuiltImport, zipBuffer: Buffer): Promise<{ id: string; zipPath: string }> {
    const id = randomUUID();
    const zipDir = join(process.cwd(), 'storage', 'imports');
    if (!existsSync(zipDir)) mkdirSync(zipDir, { recursive: true });
    const zipPath = join(zipDir, `${id}.zip`);

    const cleaned = this.repackageWithoutSensitive(zipBuffer);
    writeFileSync(zipPath, cleaned);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.import.create({
          data: {
            id,
            envName: built.envName,
            label: built.label,
            fileName: built.fileName,
            fileHash: built.fileHash,
            sourceComponentEic: built.sourceComponentEic,
            sourceDumpTimestamp: built.sourceDumpTimestamp,
            dumpType: built.dumpType,
            zipPath,
            effectiveDate: built.effectiveDate,
            warningsJson: JSON.stringify(built.warnings),
          },
        });

        for (const c of built.components) {
          const created = await tx.importedComponent.create({
            data: {
              importId: id,
              eic: c.eic,
              type: c.type,
              organization: c.organization,
              personName: c.personName,
              email: c.email,
              phone: c.phone,
              homeCdCode: c.homeCdCode,
              networksCsv: c.networksCsv,
              displayName: c.displayName,
              country: c.country,
              lat: c.lat,
              lng: c.lng,
              isDefaultPosition: c.isDefaultPosition,
              sourceType: c.sourceType,
              creationTs: c.creationTs,
              modificationTs: c.modificationTs,
            },
          });
          if (c.urls.length > 0) {
            await tx.importedComponentUrl.createMany({
              data: c.urls.map((u) => ({
                importedComponentId: created.id,
                network: u.network,
                url: u.url,
              })),
            });
          }
        }

        if (built.paths.length > 0) {
          await tx.importedPath.createMany({
            data: built.paths.map((p) => ({ importId: id, ...p })),
          });
        }

        if (built.messagingStats.length > 0) {
          await tx.importedMessagingStat.createMany({
            data: built.messagingStats.map((s) => ({ importId: id, ...s })),
          });
        }

        if (built.appProperties.length > 0) {
          await tx.importedAppProperty.createMany({
            data: built.appProperties.map((p) => ({ importId: id, key: p.key, value: p.value })),
          });
        }
      });
    } catch (err) {
      try {
        if (existsSync(zipPath)) unlinkSync(zipPath);
      } catch (cleanupErr) {
        this.logger.warn(`Cleanup failed for ${zipPath}: ${(cleanupErr as Error).message}`);
      }
      throw err;
    }

    return { id, zipPath };
  }

  repackageWithoutSensitive(buffer: Buffer): Buffer {
    try {
      const input = new AdmZip(buffer);
      const output = new AdmZip();
      for (const entry of input.getEntries()) {
        if (entry.isDirectory) continue;
        // Check both full entry name and the basename (for nested paths)
        const basename = entry.entryName.split('/').pop() ?? entry.entryName;
        if (SENSITIVE_FILES.has(entry.entryName) || SENSITIVE_FILES.has(basename)) continue;
        output.addFile(entry.entryName, entry.getData());
      }
      return output.toBuffer();
    } catch (e) {
      this.logger.warn(
        `repackageWithoutSensitive: could not parse zip, persisting original buffer (${(e as Error).message})`,
      );
      return buffer;
    }
  }
}
