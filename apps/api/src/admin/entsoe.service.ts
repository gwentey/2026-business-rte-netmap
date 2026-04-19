import { Injectable } from '@nestjs/common';
import { parse as csvParse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EntsoeService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(buffer: Buffer): Promise<{ count: number; refreshedAt: string }> {
    const content = buffer.toString('utf-8');
    const rows = csvParse(content, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Array<Record<string, string>>;

    const refreshedAt = new Date();
    await this.prisma.entsoeEntry.deleteMany();

    const batch: Array<{
      eic: string; displayName: string | null; organization: string | null;
      country: string | null; function: string | null; refreshedAt: Date;
    }> = [];
    for (const row of rows) {
      const eic = (row['EicCode'] ?? '').trim();
      if (!eic) continue;
      batch.push({
        eic,
        displayName: nonEmpty(row['EicLongName']) ?? nonEmpty(row['EicDisplayName']),
        organization: nonEmpty(row['EicDisplayName']),
        country: nonEmpty(row['MarketParticipantIsoCountryCode']),
        function: nonEmpty(row['EicTypeFunctionList']),
        refreshedAt,
      });
    }
    if (batch.length > 0) {
      await this.prisma.entsoeEntry.createMany({ data: batch });
    }
    return { count: batch.length, refreshedAt: refreshedAt.toISOString() };
  }

  async status(): Promise<{ count: number; refreshedAt: string | null }> {
    const count = await this.prisma.entsoeEntry.count();
    const first = await this.prisma.entsoeEntry.findFirst({ select: { refreshedAt: true } });
    return {
      count,
      refreshedAt: first?.refreshedAt.toISOString() ?? null,
    };
  }
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}
