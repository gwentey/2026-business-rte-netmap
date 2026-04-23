import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import { CsvReaderService } from './csv-reader.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ImportBuilderService } from './import-builder.service.js';
import { CsvPathReaderService } from './csv-path-reader.service.js';
import { PropertiesParserService } from './properties-parser.service.js';
import { RawPersisterService } from './raw-persister.service.js';
import { ImportsService } from './imports.service.js';
import { ImportsController } from './imports.controller.js';

@Module({
  imports: [PrismaModule, RegistryModule],
  controllers: [ImportsController],
  providers: [
    ZipExtractorService,
    CsvReaderService,
    XmlMadesParserService,
    ImportBuilderService,
    CsvPathReaderService,
    PropertiesParserService,
    RawPersisterService,
    ImportsService,
  ],
  exports: [ImportsService],
})
export class IngestionModule {}
