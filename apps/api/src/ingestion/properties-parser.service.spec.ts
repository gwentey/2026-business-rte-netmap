import { describe, it, expect } from 'vitest';
import { PropertiesParserService } from './properties-parser.service.js';

describe('PropertiesParserService', () => {
  const svc = new PropertiesParserService();

  it('parses simple key = value pairs', () => {
    const buf = Buffer.from('ecp.projectName = INTERNET-EP1\necp.envName = PFRFI\n');
    expect(svc.parse(buf)).toEqual({
      'ecp.projectName': 'INTERNET-EP1',
      'ecp.envName': 'PFRFI',
    });
  });

  it('tolerates key=value without spaces', () => {
    const buf = Buffer.from('ecp.projectName=INTERNET-EP1\n');
    expect(svc.parse(buf)).toEqual({ 'ecp.projectName': 'INTERNET-EP1' });
  });

  it('ignores # comments, ! comments, and blank lines', () => {
    const buf = Buffer.from(
      [
        '# line comment',
        '! bang comment',
        '',
        '   ',
        'ecp.projectName = A',
      ].join('\n'),
    );
    expect(svc.parse(buf)).toEqual({ 'ecp.projectName': 'A' });
  });

  it('handles CRLF line endings', () => {
    const buf = Buffer.from('ecp.a=1\r\necp.b=2\r\n');
    expect(svc.parse(buf)).toEqual({ 'ecp.a': '1', 'ecp.b': '2' });
  });

  it('tolerates a UTF-8 BOM at the start', () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('ecp.a = 1\n')]);
    expect(svc.parse(buf)).toEqual({ 'ecp.a': '1' });
  });

  it('tolerates values containing `=` (only first `=` is separator)', () => {
    const buf = Buffer.from('ecp.urls = https://host:8443/ECP_MODULE?foo=bar\n');
    expect(svc.parse(buf)).toEqual({
      'ecp.urls': 'https://host:8443/ECP_MODULE?foo=bar',
    });
  });

  it('preserves empty values (ecp.natEnabled = is valid)', () => {
    const buf = Buffer.from('ecp.natEnabled =\n');
    expect(svc.parse(buf)).toEqual({ 'ecp.natEnabled': '' });
  });

  it('filters sensitive keys (password, secret, privateKey, credentials)', () => {
    const buf = Buffer.from(
      [
        'ecp.security.keyStore.keyStorePass = super-secret',
        'ecp.security.keyStore.keyAlias = ecp_module_sign',
        'ecp.custom.secret = hidden',
        'ecp.custom.privateKey = priv',
        'ecp.custom.credentials = cred',
        'ecp.projectName = A',
      ].join('\n'),
    );
    const result = svc.parse(buf);
    expect(result).toEqual({
      'ecp.security.keyStore.keyAlias': 'ecp_module_sign',
      'ecp.projectName': 'A',
    });
    expect(result['ecp.security.keyStore.keyStorePass']).toBeUndefined();
    expect(result['ecp.custom.secret']).toBeUndefined();
    expect(result['ecp.custom.privateKey']).toBeUndefined();
    expect(result['ecp.custom.credentials']).toBeUndefined();
  });

  it('handles a real ECP .properties sample', () => {
    const buf = Buffer.from(
      [
        '## comment',
        'ecp.directory.client.synchronization.homeComponentDirectoryPrimaryUrl = https://10.144.0.148:8443/ECP_MODULE/',
        '',
        '# Project name',
        'ecp.projectName = INTERNET-EP1',
        '# Environment name',
        'ecp.envName = PFRFI',
      ].join('\n'),
    );
    expect(svc.parse(buf)).toEqual({
      'ecp.directory.client.synchronization.homeComponentDirectoryPrimaryUrl':
        'https://10.144.0.148:8443/ECP_MODULE/',
      'ecp.projectName': 'INTERNET-EP1',
      'ecp.envName': 'PFRFI',
    });
  });

  it('skips lines without `=`', () => {
    const buf = Buffer.from('ecp.garbage\nvalid = 1\n');
    expect(svc.parse(buf)).toEqual({ valid: '1' });
  });

  it('skips lines with empty key', () => {
    const buf = Buffer.from('= just-value\n');
    expect(svc.parse(buf)).toEqual({});
  });
});
