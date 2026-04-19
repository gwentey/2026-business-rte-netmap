import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type OverrideUpsertInput = {
  displayName?: string | null;
  type?: string | null;
  organization?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  tagsCsv?: string | null;
  notes?: string | null;
};

@Injectable()
export class OverridesService {
  constructor(private readonly prisma: PrismaService) {}

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
}
