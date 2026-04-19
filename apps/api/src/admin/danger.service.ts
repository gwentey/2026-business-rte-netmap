import { Injectable } from '@nestjs/common';
import { existsSync, unlinkSync } from 'node:fs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DangerService {
  constructor(private readonly prisma: PrismaService) {}

  async purgeImports(): Promise<{ deletedCount: number }> {
    const all = await this.prisma.import.findMany({ select: { id: true, zipPath: true } });
    for (const imp of all) {
      if (imp.zipPath && existsSync(imp.zipPath)) {
        try { unlinkSync(imp.zipPath); } catch { /* best effort */ }
      }
    }
    const result = await this.prisma.import.deleteMany();
    return { deletedCount: result.count };
  }

  async purgeOverrides(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.componentOverride.deleteMany();
    return { deletedCount: result.count };
  }

  async purgeAll(): Promise<{ imports: number; overrides: number; entsoe: number }> {
    const imports = await this.purgeImports();
    const overrides = await this.purgeOverrides();
    const entsoe = await this.prisma.entsoeEntry.deleteMany();
    return { imports: imports.deletedCount, overrides: overrides.deletedCount, entsoe: entsoe.count };
  }
}
