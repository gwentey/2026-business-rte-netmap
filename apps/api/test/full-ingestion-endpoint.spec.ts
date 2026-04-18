import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from './fixtures-loader.js';

describe('Full ingestion — Endpoint', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let snapshotId: string;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

  it('ingests the Endpoint backup and exposes a graph', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'Test Endpoint')
      .field('envName', 'OPF')
      .attach('zip', zip, { filename: 'endpoint.zip', contentType: 'application/zip' })
      .expect(201);

    snapshotId = res.body.id;
    expect(res.body.componentType).toBe('ENDPOINT');
    expect(res.body.sourceComponentCode).toBe('17V000000498771C');
    expect(res.body.cdCode).toBe('17V000002014106G');
    expect(res.body.stats.componentsCount).toBeGreaterThan(0);

    const graphRes = await request(app.getHttpServer())
      .get(`/api/snapshots/${snapshotId}/graph`)
      .expect(200);
    expect(graphRes.body.nodes.length).toBeGreaterThan(0);
    expect(graphRes.body.bounds.north).toBeGreaterThan(graphRes.body.bounds.south);
    for (const node of graphRes.body.nodes) {
      expect(Number.isFinite(node.lat)).toBe(true);
      expect(Number.isFinite(node.lng)).toBe(true);
    }
  });

  it('does not persist sensitive AppProperty keys', async () => {
    const props = await prisma.appProperty.findMany({
      where: { snapshotId },
    });
    for (const p of props) {
      expect(p.key).not.toMatch(/password|secret|privateKey/i);
    }
  });
});
