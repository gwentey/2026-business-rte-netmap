import { Injectable, BadRequestException } from '@nestjs/common';
import type {
  ProcessColorMap,
  ProcessKey,
  RegistryColorRow,
  RegistryRteEndpointRow,
} from '@carto-ecp/shared';
import { PROCESS_KEYS } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

@Injectable()
export class RegistrySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  async getEffectiveProcessColors(): Promise<ProcessColorMap> {
    const overrides = await this.prisma.processColorOverride.findMany();
    const overrideMap = new Map(overrides.map((o) => [o.process, o.color]));
    const result: Partial<ProcessColorMap> = {};
    for (const key of PROCESS_KEYS) {
      result[key] = overrideMap.get(key) ?? this.registry.processColor(key);
    }
    return result as ProcessColorMap;
  }

  async listProcessColors(): Promise<RegistryColorRow[]> {
    const overrides = await this.prisma.processColorOverride.findMany();
    const overrideMap = new Map(overrides.map((o) => [o.process, o.color]));
    return PROCESS_KEYS.map((process) => {
      const defaultColor = this.registry.processColor(process);
      const override = overrideMap.get(process);
      return {
        process,
        color: override ?? defaultColor,
        isOverride: override !== undefined,
        default: defaultColor,
      };
    });
  }

  async upsertProcessColor(process: string, color: string): Promise<void> {
    if (!this.isKnownProcess(process)) {
      throw new BadRequestException({
        code: 'INVALID_PROCESS',
        message: `Process ${process} inconnu`,
      });
    }
    if (!HEX_COLOR.test(color)) {
      throw new BadRequestException({
        code: 'INVALID_COLOR',
        message: 'Format attendu #RRGGBB',
      });
    }
    await this.prisma.processColorOverride.upsert({
      where: { process },
      create: { process, color },
      update: { color },
    });
  }

  async resetProcessColor(process: string): Promise<void> {
    if (!this.isKnownProcess(process)) {
      throw new BadRequestException({
        code: 'INVALID_PROCESS',
        message: `Process ${process} inconnu`,
      });
    }
    await this.prisma.processColorOverride.deleteMany({ where: { process } });
  }

  async listRteEndpoints(): Promise<RegistryRteEndpointRow[]> {
    const overlay = this.registry.getOverlay();
    const eics = overlay.rteEndpoints.map((e) => e.eic);
    const overrides = await this.prisma.componentOverride.findMany({
      where: { eic: { in: eics } },
    });
    const overrideMap = new Map(overrides.map((o) => [o.eic, o]));
    return overlay.rteEndpoints.map((e) => {
      const override = overrideMap.get(e.eic);
      return {
        eic: e.eic,
        code: e.code,
        displayName: override?.displayName ?? e.displayName,
        city: e.city,
        lat: override?.lat ?? e.lat,
        lng: override?.lng ?? e.lng,
        hasOverride: override !== undefined,
      };
    });
  }

  private isKnownProcess(process: string): process is ProcessKey {
    return (PROCESS_KEYS as readonly string[]).includes(process);
  }
}
