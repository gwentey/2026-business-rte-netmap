import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { AdminController } from './admin.controller.js';
import { DangerService } from './danger.service.js';
import { EntsoeService } from './entsoe.service.js';

@Module({
  imports: [PrismaModule, IngestionModule],
  controllers: [AdminController],
  providers: [DangerService, EntsoeService],
})
export class AdminModule {}
