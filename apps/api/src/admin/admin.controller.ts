import {
  BadRequestException, Controller, Delete, Get,
  Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DangerService } from './danger.service.js';
import { EntsoeService } from './entsoe.service.js';

const MAX_SIZE = 5 * 1024 * 1024;

@Controller()
export class AdminController {
  constructor(
    private readonly danger: DangerService,
    private readonly entsoe: EntsoeService,
  ) {}

  @Delete('admin/purge-imports')
  async purgeImports() {
    return this.danger.purgeImports();
  }

  @Delete('admin/purge-overrides')
  async purgeOverrides() {
    return this.danger.purgeOverrides();
  }

  @Delete('admin/purge-all')
  async purgeAll() {
    return this.danger.purgeAll();
  }

  @Post('entsoe/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async entsoeUpload(@UploadedFile() file: { originalname: string; buffer: Buffer; mimetype?: string } | undefined) {
    if (!file || !file.buffer) {
      throw new BadRequestException({ code: 'INVALID_UPLOAD', message: 'Fichier requis' });
    }
    return this.entsoe.upload(file.buffer);
  }

  @Get('entsoe/status')
  async entsoeStatus() {
    return this.entsoe.status();
  }
}
