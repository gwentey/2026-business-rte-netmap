import { describe, expect, it } from 'vitest';
import { detectDumpType } from './dump-type-detector.js';

function entries(...names: string[]): Array<{ entryName: string }> {
  return names.map((entryName) => ({ entryName }));
}

describe('detectDumpType v2', () => {
  it('detects CD via synchronized_directories.csv (exclusive)', () => {
    const r = detectDumpType(entries('application_property.csv', 'component_directory.csv', 'synchronized_directories.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
    expect(r.reason).toContain('synchronized_directories.csv');
  });

  it('detects CD via component_statistics.csv (exclusive)', () => {
    const r = detectDumpType(entries('component_directory.csv', 'component_statistics.csv', 'message_path.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects CD via pending_edit_directories.csv', () => {
    const r = detectDumpType(entries('component_directory.csv', 'pending_edit_directories.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects CD via pending_removal_directories.csv', () => {
    const r = detectDumpType(entries('component_directory.csv', 'pending_removal_directories.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects ENDPOINT via messaging_statistics.csv (exclusive)', () => {
    const r = detectDumpType(entries('application_property.csv', 'component_directory.csv', 'messaging_statistics.csv'));
    expect(r.dumpType).toBe('ENDPOINT');
    expect(r.confidence).toBe('HIGH');
    expect(r.reason).toContain('messaging_statistics.csv');
  });

  it('detects ENDPOINT via message_upload_route.csv (exclusive)', () => {
    const r = detectDumpType(entries('component_directory.csv', 'message_upload_route.csv'));
    expect(r.dumpType).toBe('ENDPOINT');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects BROKER via broker.xml', () => {
    const r = detectDumpType(entries('broker.xml', 'bootstrap.xml', 'data/journal-1.amq'));
    expect(r.dumpType).toBe('BROKER');
    expect(r.confidence).toBe('HIGH');
  });

  it('falls back to CD when only component_directory.csv present', () => {
    const r = detectDumpType(entries('component_directory.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('FALLBACK');
  });

  it('falls back to CD with reason when no ECP signature found', () => {
    const r = detectDumpType(entries('random.txt', 'other.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('FALLBACK');
    expect(r.reason).toContain('aucune signature');
  });

  it('respects explicit override (HIGH confidence)', () => {
    const r = detectDumpType(entries('messaging_statistics.csv'), 'BROKER');
    expect(r.dumpType).toBe('BROKER');
    expect(r.confidence).toBe('HIGH');
    expect(r.reason).toBe('user override');
  });

  it('prioritizes CD exclusive over ENDPOINT when both markers co-exist (conflict edge case)', () => {
    const r = detectDumpType(entries('synchronized_directories.csv', 'messaging_statistics.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('is case-insensitive on entry names', () => {
    const r = detectDumpType(entries('MESSAGING_STATISTICS.CSV', 'Component_Directory.csv'));
    expect(r.dumpType).toBe('ENDPOINT');
    expect(r.confidence).toBe('HIGH');
  });
});
