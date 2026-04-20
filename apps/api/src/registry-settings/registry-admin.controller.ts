import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Put,
} from '@nestjs/common';
import { z } from 'zod';
import { RegistrySettingsService } from './registry-settings.service.js';

const ProcessColorUpsertSchema = z
  .object({ color: z.string() })
  .strict();

@Controller()
export class RegistryAdminController {
  constructor(private readonly settings: RegistrySettingsService) {}

  @Get('registry/process-colors')
  async listColors() {
    return this.settings.listProcessColors();
  }

  @Put('registry/process-colors/:process')
  async upsertColor(
    @Param('process') process: string,
    @Body() body: unknown,
  ): Promise<{ ok: true }> {
    const parsed = ProcessColorUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_BODY',
        errors: parsed.error.issues,
      });
    }
    await this.settings.upsertProcessColor(process, parsed.data.color);
    return { ok: true };
  }

  @Delete('registry/process-colors/:process')
  @HttpCode(204)
  async deleteColor(@Param('process') process: string): Promise<void> {
    await this.settings.resetProcessColor(process);
  }

  @Get('registry/rte-endpoints')
  async listEndpoints() {
    return this.settings.listRteEndpoints();
  }
}
