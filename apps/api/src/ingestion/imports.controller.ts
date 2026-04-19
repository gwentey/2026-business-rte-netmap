import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { ImportDetail, ImportSummary, InspectResult } from '@carto-ecp/shared';
import { ImportsService } from './imports.service.js';

const CreateImportSchema = z.object({
  envName: z.string().min(1).max(64),
  label: z.string().min(1).max(256),
  dumpType: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER']).optional(),
  replaceImportId: z.string().uuid().optional(),
});

const InspectBodySchema = z.object({
  envName: z.string().min(1).max(64).optional(),
});

const UpdateImportSchema = z.object({
  label: z.string().min(1).max(256).optional(),
  effectiveDate: z.string().datetime().optional(),
}).strict();

const MAX_SIZE = 50 * 1024 * 1024;
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

@Controller('imports')
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
      replaceImportId: parsed.data.replaceImportId,
    });
  }

  @Post('inspect')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: MAX_SIZE } }))
  async inspect(
    @Body() body: unknown,
    @Query('envName') envNameQuery: string | undefined,
    @UploadedFiles() files: Array<{ originalname: string; buffer: Buffer; mimetype?: string }>,
  ): Promise<InspectResult[]> {
    const parsed = InspectBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    if (!files || files.length === 0) {
      throw new BadRequestException({ code: 'INVALID_UPLOAD', message: 'Au moins un fichier requis' });
    }
    for (const f of files) {
      if (f.mimetype && f.mimetype !== 'application/zip' && f.mimetype !== 'application/x-zip-compressed') {
        throw new BadRequestException({ code: 'INVALID_MIME', message: `MIME invalide : ${f.mimetype} (${f.originalname})` });
      }
    }
    const envName = parsed.data.envName ?? envNameQuery;
    return this.imports.inspectBatch(files, envName);
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

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<ImportDetail> {
    const parsed = UpdateImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    if (Object.keys(parsed.data).length === 0) {
      throw new BadRequestException({ code: 'INVALID_BODY', message: 'Au moins un champ à modifier requis' });
    }
    return this.imports.updateImport(id, parsed.data);
  }
}
