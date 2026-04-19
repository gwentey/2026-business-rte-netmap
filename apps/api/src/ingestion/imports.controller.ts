import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { ImportDetail, ImportSummary } from '@carto-ecp/shared';
import { ImportsService } from './imports.service.js';

const CreateImportSchema = z.object({
  envName: z.string().min(1).max(64),
  label: z.string().min(1).max(256),
  dumpType: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER']).optional(),
});

const MAX_SIZE = 50 * 1024 * 1024;
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

@Controller('api/imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async create(
    @Body() body: unknown,
    @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype?: string } | undefined,
  ): Promise<ImportDetail> {
    const parsed = CreateImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    if (!file || !file.buffer) {
      throw new BadRequestException({ code: 'INVALID_UPLOAD', message: 'Fichier manquant' });
    }
    if (
      file.mimetype &&
      file.mimetype !== 'application/zip' &&
      file.mimetype !== 'application/x-zip-compressed'
    ) {
      throw new BadRequestException({
        code: 'INVALID_MIME',
        message: `MIME invalide : ${file.mimetype}`,
      });
    }
    if (!file.buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      throw new BadRequestException({
        code: 'INVALID_MAGIC',
        message: 'Magic bytes ZIP invalides',
      });
    }
    return this.imports.createImport({
      file,
      envName: parsed.data.envName,
      label: parsed.data.label,
      dumpType: parsed.data.dumpType,
    });
  }

  @Get()
  async list(@Query('env') env?: string): Promise<ImportSummary[]> {
    return this.imports.listImports(env);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.imports.deleteImport(id);
  }
}
