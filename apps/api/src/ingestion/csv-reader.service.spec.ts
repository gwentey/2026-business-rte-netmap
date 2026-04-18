import { describe, it, expect } from 'vitest';
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
      const rows = service.readApplicationProperties(csv);
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
      const rows = service.readApplicationProperties(csv);
      expect(rows).toEqual([]);
    });
  });

  describe('readMessagePaths', () => {
    it('parses allowedSenders wildcard, DIRECT transport, and validity range', () => {
      const csv = Buffer.from(
        [
          'allowedSenders;applied;intermediateBrokerCode;intermediateComponent;messagePathType;messageType;receiver;remote;status;transportPattern;validFrom;validTo',
          '"*";true;NULL_VALUE_PLACEHOLDER;NULL_VALUE_PLACEHOLDER;BUSINESS;"*";"17V000000498771C";false;ACTIVE;DIRECT;"2025-01-01T00:00:00.000000000";"2026-01-01T00:00:00.000000000"',
        ].join('\n'),
      );
      const rows = service.readMessagePaths(csv);
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
      const rows = service.readMessagingStatistics(csv);
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
      const rows = service.readComponentDirectory(csv);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.directoryContent).toBe('<xml/>');
    });
  });
});
