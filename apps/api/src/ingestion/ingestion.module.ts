import { Module } from '@nestjs/common';
import { CsvReaderService } from './csv-reader.service.js';
import { IngestionService } from './ingestion.service.js';
import { NetworkModelBuilderService } from './network-model-builder.service.js';
import { SnapshotPersisterService } from './snapshot-persister.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';

@Module({
  providers: [
    ZipExtractorService,
    CsvReaderService,
    XmlMadesParserService,
    NetworkModelBuilderService,
    SnapshotPersisterService,
    IngestionService,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
