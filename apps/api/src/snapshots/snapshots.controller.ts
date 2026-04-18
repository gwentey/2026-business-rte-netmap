import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { IngestionService } from '../ingestion/ingestion.service.js';
import { InvalidUploadException } from '../common/errors/ingestion-errors.js';
import { createSnapshotSchema } from './dto/create-snapshot.dto.js';
import { SnapshotsService } from './snapshots.service.js';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ZIP_MIME = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

@Controller('snapshots')
export class SnapshotsController {
  constructor(
    private readonly ingestion: IngestionService,
    private readonly snapshots: SnapshotsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('zip', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (!ZIP_MIME.has(file.mimetype)) {
          cb(new InvalidUploadException('MIME type non autorisé', { mimetype: file.mimetype }), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, string>,
  ) {
    if (!file) throw new InvalidUploadException('Fichier zip manquant');
    if (file.buffer.subarray(0, 4).compare(ZIP_MAGIC) !== 0) {
      throw new InvalidUploadException('Signature ZIP invalide (magic bytes)');
    }

    const parsed = createSnapshotSchema.safeParse(body);
    if (!parsed.success) {
      throw new InvalidUploadException('Champs label/envName invalides', {
        issues: parsed.error.issues,
      });
    }

    const result = await this.ingestion.ingest({
      zipBuffer: file.buffer,
      label: parsed.data.label,
      envName: parsed.data.envName,
    });
    return this.snapshots.detail(result.snapshotId);
  }

  @Get()
  list(@Query('envName') envName?: string) {
    return this.snapshots.list(envName);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.snapshots.detail(id);
  }
}
