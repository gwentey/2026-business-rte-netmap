import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EnvsService {
  constructor(private readonly prisma: PrismaService) {}

  async listEnvs(): Promise<string[]> {
    const rows = await this.prisma.import.findMany({
      distinct: ['envName'],
      select: { envName: true },
    });
    return rows.map((r) => r.envName).sort();
  }
}
