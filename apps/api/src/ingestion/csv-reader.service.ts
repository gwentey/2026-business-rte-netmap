import { Injectable, Logger } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import { normalizeNull } from '../common/null-value-normalizer.js';
import { parseEcpDate } from '../common/date-parser.js';
import type { Warning } from '@carto-ecp/shared';
import type {
  AppPropertyRow,
  ComponentDirectoryRow,
  MessagePathRow,
  MessagingStatisticRow,
} from './types.js';

type RawRow = Record<string, string>;

@Injectable()
export class CsvReaderService {
  private readonly logger = new Logger(CsvReaderService.name);

  private readRaw(
    buffer: Buffer,
    fileName: string,
  ): { rows: RawRow[]; parseError: string | null } {
    try {
      const rows = parseCsv(buffer.toString('utf-8'), {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        relax_quotes: true,
        relax_column_count: false,
      }) as RawRow[];
      return { rows, parseError: null };
    } catch (err) {
      const message = (err as Error).message;
      this.logger.warn(`CSV parse error (${fileName}): ${message}`);
      return { rows: [], parseError: message };
    }
  }

  private pushCsvWarning(
    warnings: Warning[],
    fileName: string,
    parseError: string,
  ): void {
    warnings.push({
      code: 'CSV_PARSE_ERROR',
      message: `${fileName} : ${parseError}`,
      context: { fileName },
    });
  }

  private str(row: RawRow, key: string): string | null {
    const v = row[key];
    if (v == null) return null;
    const n = normalizeNull(v);
    if (n == null) return null;
    return n === '' ? null : n;
  }

  private bool(row: RawRow, key: string): boolean | null {
    const s = this.str(row, key);
    if (s == null) return null;
    if (s === 'true') return true;
    if (s === 'false') return false;
    return null;
  }

  private num(row: RawRow, key: string): number | null {
    const s = this.str(row, key);
    if (s == null) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  private date(row: RawRow, key: string): Date | null {
    return parseEcpDate(this.str(row, key));
  }

  readApplicationProperties(buffer: Buffer, warnings: Warning[]): AppPropertyRow[] {
    const { rows, parseError } = this.readRaw(buffer, 'application_property.csv');
    if (parseError !== null) this.pushCsvWarning(warnings, 'application_property.csv', parseError);
    return rows.map((row) => ({
      key: this.str(row, 'key') ?? '',
      value: this.str(row, 'value'),
      changedBy: this.str(row, 'changedBy'),
      createdDate: this.date(row, 'createdDate'),
      modifiedDate: this.date(row, 'modifiedDate'),
    }));
  }

  readComponentDirectory(buffer: Buffer, warnings: Warning[]): ComponentDirectoryRow[] {
    const { rows, parseError } = this.readRaw(buffer, 'component_directory.csv');
    if (parseError !== null) this.pushCsvWarning(warnings, 'component_directory.csv', parseError);
    return rows.map((row) => ({
      directoryContent: this.str(row, 'directoryContent') ?? '',
      id: this.str(row, 'id') ?? '',
      signature: this.str(row, 'signature'),
      version: this.str(row, 'version'),
    }));
  }

  readMessagePaths(buffer: Buffer, warnings: Warning[]): MessagePathRow[] {
    const { rows, parseError } = this.readRaw(buffer, 'message_path.csv');
    if (parseError !== null) this.pushCsvWarning(warnings, 'message_path.csv', parseError);
    return rows.map((row) => {
      const mpt = this.str(row, 'messagePathType');
      const tp = this.str(row, 'transportPattern');
      return {
        allowedSenders: this.str(row, 'allowedSenders'),
        applied: this.bool(row, 'applied'),
        intermediateBrokerCode: this.str(row, 'intermediateBrokerCode'),
        intermediateComponent: this.str(row, 'intermediateComponent'),
        messagePathType:
          mpt === 'ACKNOWLEDGEMENT' || mpt === 'BUSINESS' ? mpt : null,
        messageType: this.str(row, 'messageType'),
        receiver: this.str(row, 'receiver'),
        remote: this.bool(row, 'remote'),
        status: this.str(row, 'status'),
        transportPattern: tp === 'DIRECT' || tp === 'INDIRECT' ? tp : null,
        validFrom: this.date(row, 'validFrom'),
        validTo: this.date(row, 'validTo'),
      };
    });
  }

  readMessagingStatistics(buffer: Buffer, warnings: Warning[]): MessagingStatisticRow[] {
    const { rows, parseError } = this.readRaw(buffer, 'messaging_statistics.csv');
    if (parseError !== null) this.pushCsvWarning(warnings, 'messaging_statistics.csv', parseError);
    return rows.map((row) => ({
      connectionStatus: this.str(row, 'connectionStatus'),
      deleted: this.bool(row, 'deleted'),
      lastMessageDown: this.date(row, 'lastMessageDown'),
      lastMessageUp: this.date(row, 'lastMessageUp'),
      localEcpInstanceId: this.str(row, 'localEcpInstanceId'),
      remoteComponentCode: this.str(row, 'remoteComponentCode'),
      sumMessagesDown: this.num(row, 'sumMessagesDown'),
      sumMessagesUp: this.num(row, 'sumMessagesUp'),
    }));
  }
}
