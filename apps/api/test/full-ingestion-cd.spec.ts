import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, CD_FIXTURE } from './fixtures-loader.js';

describe('Full ingestion — Component Directory', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let snapshotId: string;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.snapshot.deleteMany({});
  });

  afterAll(async () => {
    if (snapshotId) {
      await prisma.snapshot.deleteMany({ where: { id: snapshotId } });
    }
    await app.close();
  });

  it('ingests the CD backup and detects componentType=COMPONENT_DIRECTORY', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'Test CD')
      .field('envName', 'OPF')
      .attach('zip', zip, { filename: 'cd.zip', contentType: 'application/zip' })
      .expect(201);

    snapshotId = res.body.id;
    expect(res.body.componentType).toBe('COMPONENT_DIRECTORY');
    expect(res.body.sourceComponentCode).toBe('17V000002014106G');
    expect(res.body.cdCode).toBe('17V000002014106G');

    const graphRes = await request(app.getHttpServer())
      .get(`/api/snapshots/${snapshotId}/graph`)
      .expect(200);
    const hasCdNode = graphRes.body.nodes.some(
      (n: { kind: string; eic: string }) => n.kind === 'RTE_CD' && n.eic === '17V000002014106G',
    );
    expect(hasCdNode).toBe(true);
  });
});
