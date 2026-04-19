import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE, CD_FIXTURE } from './fixtures-loader.js';

describe('Batch upload (integration)', () => {
  let imports: ImportsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'INTEG_BATCH' } } });
  }, 60_000);

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: { startsWith: 'INTEG_BATCH' } } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch { /* best effort */ } }
    }
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'INTEG_BATCH' } } });
  }, 60_000);

  it('inspectBatch detects mixed types correctly', async () => {
    const zipEndpoint = buildZipFromFixture(ENDPOINT_FIXTURE);
    const zipCd = buildZipFromFixture(CD_FIXTURE);

    const results = await imports.inspectBatch(
      [
        { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zipEndpoint },
        { originalname: `${CD_FIXTURE}.zip`, buffer: zipCd },
        { originalname: 'garbage.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]) },
      ],
      'INTEG_BATCH_MIX',
    );

    expect(results).toHaveLength(3);
    expect(results[0]!.dumpType).toBe('ENDPOINT');
    expect(results[0]!.confidence).toBe('HIGH');
    expect(results[1]!.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(results[1]!.confidence).toBe('HIGH');
    // garbage.zip : ZIP magic valide mais aucune signature ECP → FALLBACK
    expect(results[2]!.confidence).toBe('FALLBACK');
  }, 30_000);

  it('sequential createImport : 2 valid + 1 invalid', async () => {
    const zipEndpoint = buildZipFromFixture(ENDPOINT_FIXTURE);
    const zipCd = buildZipFromFixture(CD_FIXTURE);

    // 1er : succeeds
    const first = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zipEndpoint },
      envName: 'INTEG_BATCH_SEQ',
      label: 'first',
    });
    expect(first.id).toBeTruthy();

    // 2e : succeeds (CD)
    const second = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zipCd },
      envName: 'INTEG_BATCH_SEQ',
      label: 'second',
    });
    expect(second.id).toBeTruthy();

    // 3e : invalid — pas un vrai ZIP
    await expect(
      imports.createImport({
        file: { originalname: 'garbage.zip', buffer: Buffer.from('not a zip') },
        envName: 'INTEG_BATCH_SEQ',
        label: 'third',
      }),
    ).rejects.toThrow();

    // Vérif DB : 2 imports créés, le 3e n'a pas été persisté
    const list = await imports.listImports('INTEG_BATCH_SEQ');
    expect(list).toHaveLength(2);
    expect(list.map((i) => i.label).sort()).toEqual(['first', 'second']);
  }, 30_000);
});
