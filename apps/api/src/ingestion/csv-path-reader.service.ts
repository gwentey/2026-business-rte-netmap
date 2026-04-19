import { Injectable } from '@nestjs/common';
import type { Warning } from '@carto-ecp/shared';
import type { CdMessagePathRow } from './csv-reader.service.js';
import type { BuiltImportedPath } from './types.js';

@Injectable()
export class CsvPathReaderService {
  readCdMessagePaths(
    rows: ReadonlyArray<CdMessagePathRow>,
    warnings: Warning[],
  ): { paths: BuiltImportedPath[]; warnings: Warning[] } {
    const paths: BuiltImportedPath[] = [];

    for (const row of rows) {
      const senders = splitList(row.allowedSenders);
      const receivers = splitList(row.receivers);

      if (receivers.length === 0) {
        warnings.push({
          code: 'CSV_PATH_NO_RECEIVER',
          message: `message_path row skipped (no receiver) — messageType=${row.messageType}`,
        });
        continue;
      }

      const transportPattern =
        row.transportPattern === 'DIRECT' || row.transportPattern === 'INDIRECT'
          ? row.transportPattern
          : null;
      if (transportPattern === null) {
        warnings.push({
          code: 'CSV_PATH_UNKNOWN_TRANSPORT',
          message: `message_path row skipped (unknown transportPattern "${row.transportPattern}") — messageType=${row.messageType}`,
        });
        continue;
      }

      const validToRaw = row.validTo.trim() || row.validUntil.trim();
      const validTo = parseDate(validToRaw);
      const validFrom = parseDate(row.validFrom);
      const isExpired = validTo != null && validTo.getTime() < Date.now();

      for (const sender of senders) {
        for (const receiver of receivers) {
          paths.push({
            receiverEic: receiver,
            senderEic: sender,
            messageType: row.messageType,
            transportPattern,
            intermediateBrokerEic: nonEmpty(row.intermediateBrokerCode),
            validFrom,
            validTo,
            isExpired,
          });
        }
      }
    }

    return { paths, warnings };
  }
}

function splitList(raw: string | null | undefined): string[] {
  if (raw == null) return ['*'];
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === '*') return ['*'];
  // Try pipe first, then comma, then semicolon (fallback)
  if (trimmed.includes('|'))
    return trimmed
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  if (trimmed.includes(','))
    return trimmed
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  if (trimmed.includes(';'))
    return trimmed
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  return [trimmed];
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
