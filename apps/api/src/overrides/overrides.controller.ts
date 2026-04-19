import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Put,
} from '@nestjs/common';
import { z } from 'zod';
import { OverridesService } from './overrides.service.js';

const OverrideUpsertSchema = z.object({
  displayName: z.string().min(1).max(256).nullable().optional(),
  type: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER', 'BA']).nullable().optional(),
  organization: z.string().max(256).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  tagsCsv: z.string().max(512).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

@Controller()
export class OverridesController {
  constructor(private readonly overrides: OverridesService) {}

  @Get('admin/components')
  async listAdminComponents() {
    return this.overrides.listAdminComponents();
  }

  @Put('overrides/:eic')
  async upsert(@Param('eic') eic: string, @Body() body: unknown) {
    const parsed = OverrideUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    return this.overrides.upsert(eic, parsed.data);
  }

  @Delete('overrides/:eic')
  @HttpCode(204)
  async delete(@Param('eic') eic: string): Promise<void> {
    await this.overrides.delete(eic);
  }
}
