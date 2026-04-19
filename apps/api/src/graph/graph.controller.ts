import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type { GraphResponse } from '@carto-ecp/shared';
import { GraphService } from './graph.service.js';

@Controller('graph')
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get()
  async getGraph(
    @Query('env') env: string,
    @Query('refDate') refDate?: string,
  ): Promise<GraphResponse> {
    if (!env || env.trim().length === 0) {
      throw new BadRequestException({
        code: 'MISSING_ENV',
        message: 'Query param "env" is required',
      });
    }
    let parsedRef: Date | undefined;
    if (refDate) {
      const d = new Date(refDate);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException({
          code: 'INVALID_REF_DATE',
          message: `Invalid ISO date: ${refDate}`,
        });
      }
      parsedRef = d;
    }
    return this.graph.getGraph(env, parsedRef);
  }
}
