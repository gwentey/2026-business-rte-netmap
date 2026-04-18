import { Controller, Get, Param } from '@nestjs/common';
import { GraphService } from './graph.service.js';

@Controller('snapshots')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get(':id/graph')
  getGraph(@Param('id') id: string) {
    return this.graphService.getGraph(id);
  }
}
