import { describe, it, expect } from 'vitest';
import type { Warning } from '@carto-ecp/shared';
import { CsvReaderService } from './csv-reader.service.js';

describe('CsvReaderService', () => {
  const service = new CsvReaderService();

  describe('readApplicationProperties', () => {
    it('parses rows with NULL_VALUE_PLACEHOLDER → null', () => {
      const csv = Buffer.from(
        [
          'changedBy;createdDate;key;modifiedDate;value',
          'NULL_VALUE_PLACEHOLDER;"2025-03-12T15:34:48.560980651";"ecp.componentCode";"2025-03-12T15:34:48.576688688";"17V000000498771C"',
        ].join('\n'),
      );
      const rows = service.readApplicationProperties(csv, []);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.changedBy).toBeNull();
      expect(rows[0]!.key).toBe('ecp.componentCode');
      expect(rows[0]!.value).toBe('17V000000498771C');
      expect(rows[0]!.createdDate).toBeInstanceOf(Date);
    });

    it('ignores malformed rows (records warning internally, does not throw)', () => {
      const csv = Buffer.from(
        [
          'changedBy;createdDate;key;modifiedDate;value',
          'too;few;cols',
        ].join('\n'),
      );
      const rows = service.readApplicationProperties(csv, []);
      expect(rows).toEqual([]);
    });
  });

  describe('readEndpointMessagePaths', () => {
    it('parses allowedSenders wildcard, DIRECT transport, and validity range', () => {
      const csv = Buffer.from(
        [
          'allowedSenders;applied;intermediateBrokerCode;intermediateComponent;messagePathType;messageType;receiver;remote;status;transportPattern;validFrom;validTo',
          '"*";true;NULL_VALUE_PLACEHOLDER;NULL_VALUE_PLACEHOLDER;BUSINESS;"*";"17V000000498771C";false;ACTIVE;DIRECT;"2025-01-01T00:00:00.000000000";"2026-01-01T00:00:00.000000000"',
        ].join('\n'),
      );
      const rows = service.readEndpointMessagePaths(csv, []);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.allowedSenders).toBe('*');
      expect(rows[0]!.applied).toBe(true);
      expect(rows[0]!.transportPattern).toBe('DIRECT');
      expect(rows[0]!.intermediateBrokerCode).toBeNull();
      expect(rows[0]!.validFrom).toBeInstanceOf(Date);
      expect(rows[0]!.validTo).toBeInstanceOf(Date);
    });
  });

  describe('readMessagingStatistics', () => {
    it('parses numeric counters and connection status', () => {
      const csv = Buffer.from(
        [
          'connectionStatus;deleted;lastMessageDown;lastMessageUp;localEcpInstanceId;remoteComponentCode;sumMessagesDown;sumMessagesUp',
          'CONNECTED;false;"2026-04-17T10:00:00.000000000";"2026-04-17T10:05:00.000000000";ID1;"17V000002014106G";42;17',
        ].join('\n'),
      );
      const rows = service.readMessagingStatistics(csv, []);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.connectionStatus).toBe('CONNECTED');
      expect(rows[0]!.sumMessagesDown).toBe(42);
      expect(rows[0]!.sumMessagesUp).toBe(17);
      expect(rows[0]!.deleted).toBe(false);
    });
  });

  describe('readComponentDirectory', () => {
    it('returns the single-row blob XML', () => {
      const csv = Buffer.from(
        [
          'directoryContent;id;signature;version',
          '"<xml/>";ID1;SIG;V1',
        ].join('\n'),
      );
      const rows = service.readComponentDirectory(csv, []);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.directoryContent).toBe('<xml/>');
    });
  });

  describe('CSV_PARSE_ERROR warning', () => {
    it('pushes CSV_PARSE_ERROR warning when CSV is malformed', () => {
      const malformed = Buffer.from('header1;header2\nonly-one-col\n');
      const warnings: Warning[] = [];
      const rows = service.readEndpointMessagePaths(malformed, warnings);
      expect(rows).toEqual([]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'CSV_PARSE_ERROR',
        context: { fileName: 'message_path.csv' },
      });
    });
  });

  describe('readMessagePaths (CD dump)', () => {
    it('parses a valid CD message_path.csv with headers', () => {
      const csv = [
        'allowedSenders;intermediateBrokerCode;intermediateComponent;messageType;receivers;transportPattern;validFrom;validTo;validUntil',
        '17V-A;;;A06;17V-X;DIRECT;2026-01-01T00:00:00.000Z;;',
        '17V-B|17V-C;BROKER-1;;A07;17V-Y|17V-Z;INDIRECT;2026-01-01T00:00:00.000Z;2026-12-31T23:59:59.000Z;',
      ].join('\n');

      const extracted = { 'message_path.csv': Buffer.from(csv) };
      const warnings: Warning[] = [];

      const rows = service.readMessagePaths(extracted as any, warnings);

      expect(rows).toHaveLength(2);
      expect(rows[0]!.allowedSenders).toBe('17V-A');
      expect(rows[0]!.messageType).toBe('A06');
      expect(rows[0]!.transportPattern).toBe('DIRECT');
      expect(rows[0]!.receivers).toBe('17V-X');
      expect(rows[1]!.allowedSenders).toBe('17V-B|17V-C');
      expect(rows[1]!.intermediateBrokerCode).toBe('BROKER-1');
      expect(rows[1]!.receivers).toBe('17V-Y|17V-Z');
      expect(rows[1]!.validTo).toBe('2026-12-31T23:59:59.000Z');
      expect(warnings).toHaveLength(0);
    });

    it('returns empty array when message_path.csv is absent', () => {
      const extracted = {};
      const warnings: Warning[] = [];
      expect(service.readMessagePaths(extracted as any, warnings)).toEqual([]);
      expect(warnings).toHaveLength(0);
    });

    it('returns empty array when message_path.csv has only header', () => {
      const csv = 'allowedSenders;intermediateBrokerCode;intermediateComponent;messageType;receivers;transportPattern;validFrom;validTo;validUntil';
      const extracted = { 'message_path.csv': Buffer.from(csv) };
      const warnings: Warning[] = [];
      expect(service.readMessagePaths(extracted as any, warnings)).toEqual([]);
    });

    it('emits CSV_PARSE_ERROR warning on malformed content', () => {
      const csv = [
        'allowedSenders;intermediateBrokerCode;intermediateComponent;messageType;receivers;transportPattern;validFrom;validTo;validUntil',
        '17V-A;;;"unterminated;17V-X;DIRECT;;;',
      ].join('\n');
      const extracted = { 'message_path.csv': Buffer.from(csv) };
      const warnings: Warning[] = [];
      service.readMessagePaths(extracted as any, warnings);
      expect(warnings.some((w) => w.code === 'CSV_PARSE_ERROR')).toBe(true);
    });
  });
});
