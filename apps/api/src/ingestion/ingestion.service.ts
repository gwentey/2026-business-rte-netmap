import { Injectable, Logger } from '@nestjs/common';
import { InvalidUploadException } from '../common/errors/ingestion-errors.js';
import { CsvReaderService } from './csv-reader.service.js';
import { NetworkModelBuilderService } from './network-model-builder.service.js';
import { SnapshotPersisterService } from './snapshot-persister.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import type { IngestionInput, IngestionResult } from './types.js';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly zipExtractor: ZipExtractorService,
    private readonly csvReader: CsvReaderService,
    private readonly xmlParser: XmlMadesParserService,
    private readonly builder: NetworkModelBuilderService,
    private readonly persister: SnapshotPersisterService,
  ) {}

  async ingest(input: IngestionInput): Promise<IngestionResult> {
    const startedAt = Date.now();
    this.logger.log(`ingestion.started (${input.zipBuffer.length} bytes)`);

    const extracted = this.zipExtractor.extract(input.zipBuffer);
    const appProperties = this.csvReader.readApplicationProperties(
      extracted.files.get('application_property.csv')!,
    );
    const componentDirectoryRows = this.csvReader.readComponentDirectory(
      extracted.files.get('component_directory.csv')!,
    );
    if (componentDirectoryRows.length === 0) {
      throw new InvalidUploadException(
        'component_directory.csv ne contient aucune ligne de données',
        { fileName: 'component_directory.csv' },
      );
    }
    const xmlBlob = componentDirectoryRows[0]!.directoryContent;
    const madesTree = this.xmlParser.parse(xmlBlob);

    const messagePathsBuf = extracted.files.get('message_path.csv');
    const statsBuf = extracted.files.get('messaging_statistics.csv');

    const localMessagePaths = messagePathsBuf ? this.csvReader.readMessagePaths(messagePathsBuf) : [];
    const messagingStats = statsBuf ? this.csvReader.readMessagingStatistics(statsBuf) : [];

    const networkSnapshot = this.builder.build({
      appProperties,
      madesTree,
      messagingStats,
      localMessagePaths,
      envName: input.envName,
    });

    const result = await this.persister.persist(networkSnapshot, input.zipBuffer, input.label);
    const duration = Date.now() - startedAt;
    this.logger.log(
      `ingestion.completed snapshotId=${result.snapshotId} components=${networkSnapshot.components.length} paths=${networkSnapshot.messagePaths.length} warnings=${networkSnapshot.warnings.length} duration=${duration}ms`,
    );
    return result;
  }
}
