import { Controller, Get } from '@nestjs/common';
import { EnvsService } from './envs.service.js';

@Controller('api/envs')
export class EnvsController {
  constructor(private readonly envs: EnvsService) {}

  @Get()
  async list(): Promise<string[]> {
    return this.envs.listEnvs();
  }
}
