import { Injectable, Logger } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import { normalizeNull } from '../common/null-value-normalizer.js';
import { parseEcpDate } from '../common/date-parser.js';
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

  private readRaw(buffer: Buffer): RawRow[] {
    try {
      return parseCsv(buffer.toString('utf-8'), {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        trim: true,
        quote: '"',
        relax_quotes: true,
        relax_column_count: false,
      }) as RawRow[];
    } catch (err) {
      this.logger.warn(`CSV parse error: ${(err as Error).message}`);
      return [];
    }
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

  readApplicationProperties(buffer: Buffer): AppPropertyRow[] {
    return this.readRaw(buffer).map((row) => ({
      key: this.str(row, 'key') ?? '',
      value: this.str(row, 'value'),
      changedBy: this.str(row, 'changedBy'),
      createdDate: this.date(row, 'createdDate'),
      modifiedDate: this.date(row, 'modifiedDate'),
    }));
  }

  readComponentDirectory(buffer: Buffer): ComponentDirectoryRow[] {
    return this.readRaw(buffer).map((row) => ({
      directoryContent: this.str(row, 'directoryContent') ?? '',
      id: this.str(row, 'id') ?? '',
      signature: this.str(row, 'signature'),
      version: this.str(row, 'version'),
    }));
  }

  readMessagePaths(buffer: Buffer): MessagePathRow[] {
    return this.readRaw(buffer).map((row) => {
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

  readMessagingStatistics(buffer: Buffer): MessagingStatisticRow[] {
    return this.readRaw(buffer).map((row) => ({
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
