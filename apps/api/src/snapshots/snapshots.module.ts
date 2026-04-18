import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { SnapshotsController } from './snapshots.controller.js';
import { SnapshotsService } from './snapshots.service.js';

@Module({
  imports: [IngestionModule],
  controllers: [SnapshotsController],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
