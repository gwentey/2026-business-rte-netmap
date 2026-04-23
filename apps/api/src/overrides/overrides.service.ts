import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import {
  mergeComponentsLatestWins,
  type ImportedComponentWithImport,
} from '../graph/merge-components.js';
import { applyCascade } from '../graph/apply-cascade.js';
import type { AdminComponentRow, OverrideUpsertInput } from '@carto-ecp/shared';

@Injectable()
export class OverridesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  async upsert(eic: string, patch: OverrideUpsertInput) {
    return this.prisma.componentOverride.upsert({
      where: { eic },
      create: { eic, ...patch },
      update: { ...patch },
    });
  }

  async delete(eic: string): Promise<void> {
    const existing = await this.prisma.componentOverride.findUnique({ where: { eic } });
    if (!existing) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: `Override for EIC ${eic} not found`,
      });
    }
    await this.prisma.componentOverride.delete({ where: { eic } });
  }

  async listAdminComponents(): Promise<AdminComponentRow[]> {
    const [importedComponents, overrides, entsoeEntries] = await Promise.all([
      this.prisma.importedComponent.findMany({
        include: { urls: true, import: { select: { effectiveDate: true } } },
      }),
      this.prisma.componentOverride.findMany(),
      this.prisma.entsoeEntry.findMany(),
    ]);

    const componentRows: ImportedComponentWithImport[] = importedComponents.map((c) => ({
      eic: c.eic,
      type: c.type,
      organization: c.organization,
      personName: c.personName,
      email: c.email,
      phone: c.phone,
      homeCdCode: c.homeCdCode,
      networksCsv: c.networksCsv,
      displayName: c.displayName,
      projectName: c.projectName,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
      isDefaultPosition: c.isDefaultPosition,
      sourceType: c.sourceType,
      creationTs: c.creationTs,
      modificationTs: c.modificationTs,
      urls: c.urls.map((u) => ({ network: u.network, url: u.url })),
      _effectiveDate: c.import.effectiveDate,
    }));

    const mergedByEic = mergeComponentsLatestWins(componentRows);
    const overrideByEic = new Map(overrides.map((o) => [o.eic, o]));
    const entsoeByEic = new Map(entsoeEntries.map((e) => [e.eic, e]));
    const mapConfig = this.registry.getMapConfig();
    const defaultFallback = {
      lat: (mapConfig as { defaultLat?: number }).defaultLat ?? 50.8503,
      lng: (mapConfig as { defaultLng?: number }).defaultLng ?? 4.3517,
    };

    const importsCountByEic = new Map<string, Set<string>>();
    for (const c of importedComponents) {
      const set = importsCountByEic.get(c.eic) ?? new Set<string>();
      set.add(c.importId);
      importsCountByEic.set(c.eic, set);
    }

    const rows: AdminComponentRow[] = [];
    for (const [eic, merged] of mergedByEic) {
      const override = overrideByEic.get(eic) ?? null;
      const entsoe = entsoeByEic.get(eic) ?? null;
      const registryEntry = this.registry.resolveEic(eic);
      const global = applyCascade(eic, merged, { override, entsoe, registry: registryEntry }, defaultFallback);

      rows.push({
        eic,
        current: {
          displayName: global.displayName,
          type: global.type,
          organization: global.organization,
          country: global.country,
          lat: global.lat,
          lng: global.lng,
          isDefaultPosition: global.isDefaultPosition,
        },
        override: override
          ? {
              displayName: override.displayName,
              type: override.type,
              organization: override.organization,
              country: override.country,
              lat: override.lat,
              lng: override.lng,
              tagsCsv: override.tagsCsv,
              notes: override.notes,
              updatedAt: override.updatedAt.toISOString(),
            }
          : null,
        importsCount: importsCountByEic.get(eic)?.size ?? 0,
      });
    }

    rows.sort((a, b) => a.eic.localeCompare(b.eic));
    return rows;
  }
}
