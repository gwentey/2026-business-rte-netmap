import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizeOrgName } from './normalize-org-name.js';

type SeedFile = {
  version: number;
  entries: Array<{
    organizationName: string;
    displayName: string;
    country?: string | null;
    address?: string | null;
    typeHint?: string | null;
    lat?: number | null;
    lng?: number | null;
    notes?: string | null;
  }>;
};

@Injectable()
export class OrganizationSeederService implements OnModuleInit {
  private readonly logger = new Logger(OrganizationSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      const seedPath = this.resolveSeedPath();
      const content = await readFile(seedPath, 'utf-8');
      const seed = JSON.parse(content) as SeedFile;
      if (typeof seed.version !== 'number' || !Array.isArray(seed.entries)) {
        this.logger.warn('Seed file malformed (missing version or entries)');
        return;
      }
      const result = await this.applySeed(seed);
      this.logger.log(
        `OrganizationEntry seed v${seed.version} — inserted: ${result.inserted}, refreshed: ${result.refreshed}, preserved: ${result.preserved}`,
      );
    } catch (err) {
      this.logger.warn(
        `OrganizationSeederService skipped: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Applique le seed. Stratégie :
   *  - Entry absente en DB → create avec seedVersion = seed.version
   *  - Entry présente avec userEdited=false ET seedVersion < seed.version
   *    → refresh des champs + bump seedVersion (applique une mise à jour MCO)
   *  - Entry présente avec userEdited=true → preserve les champs, bump
   *    juste seedVersion pour tracer qu'on a vu cette version
   *  - Entry présente avec seedVersion >= seed.version → no-op
   *
   * Exposée en public pour permettre les tests unitaires (au lieu de passer
   * par onModuleInit qui dépend du système de fichiers).
   */
  async applySeed(
    seed: SeedFile,
  ): Promise<{ inserted: number; refreshed: number; preserved: number }> {
    let inserted = 0;
    let refreshed = 0;
    let preserved = 0;

    for (const entry of seed.entries) {
      const normalized = normalizeOrgName(entry.organizationName);
      if (normalized == null || !entry.displayName) continue;

      const existing = await this.prisma.organizationEntry.findUnique({
        where: { organizationName: normalized },
      });

      if (!existing) {
        await this.prisma.organizationEntry.create({
          data: {
            organizationName: normalized,
            displayName: entry.displayName,
            country: entry.country ?? null,
            address: entry.address ?? null,
            typeHint: entry.typeHint ?? null,
            lat: entry.lat ?? null,
            lng: entry.lng ?? null,
            notes: entry.notes ?? null,
            seedVersion: seed.version,
            userEdited: false,
          },
        });
        inserted++;
        continue;
      }

      if (existing.seedVersion >= seed.version) {
        continue; // no-op, déjà à la bonne version
      }

      if (existing.userEdited) {
        // Champs édités par l'utilisateur → ne touche à rien sauf seedVersion
        await this.prisma.organizationEntry.update({
          where: { id: existing.id },
          data: { seedVersion: seed.version },
        });
        preserved++;
      } else {
        // Refresh complet depuis le seed
        await this.prisma.organizationEntry.update({
          where: { id: existing.id },
          data: {
            displayName: entry.displayName,
            country: entry.country ?? null,
            address: entry.address ?? null,
            typeHint: entry.typeHint ?? null,
            lat: entry.lat ?? null,
            lng: entry.lng ?? null,
            notes: entry.notes ?? null,
            seedVersion: seed.version,
          },
        });
        refreshed++;
      }
    }

    return { inserted, refreshed, preserved };
  }

  private resolveSeedPath(): string {
    const base = process.env.REGISTRY_PATH
      ? resolve(process.env.REGISTRY_PATH)
      : resolve(process.cwd(), '../../packages/registry');
    return resolve(base, 'organization-memory-seed.json');
  }
}
