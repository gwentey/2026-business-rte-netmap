import { Injectable } from '@nestjs/common';
import type { SnapshotDetail, SnapshotSummary, Warning } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { SnapshotNotFoundException } from '../common/errors/ingestion-errors.js';

@Injectable()
export class SnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(envName?: string): Promise<SnapshotSummary[]> {
    const rows = await this.prisma.snapshot.findMany({
      where: envName ? { envName } : undefined,
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      envName: r.envName,
      componentType: r.componentType as SnapshotSummary['componentType'],
      sourceComponentCode: r.sourceComponentCode,
      cdCode: r.cdCode,
      uploadedAt: r.uploadedAt.toISOString(),
      warningCount: (JSON.parse(r.warningsJson) as Warning[]).length,
    }));
  }

  async detail(id: string): Promise<SnapshotDetail> {
    const row = await this.prisma.snapshot.findUnique({
      where: { id },
      include: {
        _count: { select: { components: true, messagePaths: true, messagingStats: true } },
      },
    });
    if (!row) throw new SnapshotNotFoundException(id);
    const warnings = JSON.parse(row.warningsJson) as Warning[];
    return {
      id: row.id,
      label: row.label,
      envName: row.envName,
      componentType: row.componentType as SnapshotDetail['componentType'],
      sourceComponentCode: row.sourceComponentCode,
      cdCode: row.cdCode,
      uploadedAt: row.uploadedAt.toISOString(),
      warningCount: warnings.length,
      organization: row.organization,
      stats: {
        componentsCount: row._count.components,
        pathsCount: row._count.messagePaths,
        statsCount: row._count.messagingStats,
      },
      warnings,
    };
  }
}
