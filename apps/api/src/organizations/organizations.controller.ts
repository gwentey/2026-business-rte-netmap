import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { OrganizationsService } from './organizations.service.js';

const MAX_SIZE = 5 * 1024 * 1024;

const UpsertSchema = z
  .object({
    organizationName: z.string().min(1).max(256).optional(),
    displayName: z.string().min(1).max(256).optional(),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .optional(),
    address: z.string().max(1024).nullable().optional(),
    typeHint: z.string().max(64).nullable().optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .strict();

@Controller('admin/organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  async listAll() {
    return this.organizations.listAll();
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = UpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    if (!parsed.data.displayName) {
      throw new BadRequestException({ code: 'DISPLAY_NAME_REQUIRED', message: 'displayName est obligatoire' });
    }
    return this.organizations.create(parsed.data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    return this.organizations.update(id, parsed.data);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.organizations.delete(id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async importJson(
    @UploadedFile() file: { originalname: string; buffer: Buffer } | undefined,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException({ code: 'INVALID_UPLOAD', message: 'Fichier requis' });
    }
    return this.organizations.importJson(file.buffer);
  }

  @Get('export')
  @Header('Content-Type', 'application/json; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="organization-memory.json"')
  async exportJson(): Promise<StreamableFile> {
    const buffer = await this.organizations.exportJson();
    return new StreamableFile(buffer);
  }
}
