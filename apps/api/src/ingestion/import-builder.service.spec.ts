import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { ImportBuilderService } from './import-builder.service.js';

describe('ImportBuilderService — composants', () => {
  let builder: ImportBuilderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  it('builds ImportedComponent with raw CSV fields and no cascade resolution', () => {
    const csvRow = {
      eic: '17V000000498771C',
      componentCode: 'ECP-INTERNET-2',
      organization: 'RTE',
      personName: 'John Doe',
      email: 'john@rte-france.com',
      phone: '+33-1-00-00-00-00',
      homeCdCode: '17V000002014106G',
      networks: 'PUBLIC_NETWORK,INTERNET',
      xml: '',
    };
    const result = builder.buildFromLocalCsv([csvRow]);
    expect(result.components).toHaveLength(1);
    const c = result.components[0]!;
    expect(c.eic).toBe('17V000000498771C');
    expect(c.type).toBe('ENDPOINT');
    expect(c.organization).toBe('RTE');
    expect(c.email).toBe('john@rte-france.com');
    expect(c.networksCsv).toBe('PUBLIC_NETWORK,INTERNET');
    expect(c.lat).toBeNull();
    expect(c.lng).toBeNull();
    expect(c.isDefaultPosition).toBe(true);
    expect(c.sourceType).toBe('LOCAL_CSV');
  });

  it('types the component as COMPONENT_DIRECTORY when componentCode equals the eic (CD self-reference)', () => {
    const csvRow = {
      eic: '17V000002014106G',
      componentCode: '17V000002014106G',
      organization: 'RTE',
      networks: '',
      xml: '',
    };
    const result = builder.buildFromLocalCsv([csvRow]);
    expect(result.components[0]!.type).toBe('COMPONENT_DIRECTORY');
  });

  it('accumulates multiple rows into the components array', () => {
    const rows = [
      { eic: 'A', componentCode: 'A', organization: 'RTE', networks: '', xml: '' },
      { eic: 'B', componentCode: 'ECP-X', organization: 'OTHER_TSO', networks: '', xml: '' },
    ];
    const result = builder.buildFromLocalCsv(rows);
    expect(result.components).toHaveLength(2);
    expect(result.components[0]!.type).toBe('COMPONENT_DIRECTORY');
    expect(result.components[1]!.type).toBe('ENDPOINT');
  });
});
