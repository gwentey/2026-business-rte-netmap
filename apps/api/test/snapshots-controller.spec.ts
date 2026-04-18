import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from './fixtures-loader.js';

describe('SnapshotsController — upload rejections', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let createdSnapshotId: string | null = null;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.snapshot.deleteMany({
      where: { label: { startsWith: 'TestP21-' } },
    });
  });

  afterAll(async () => {
    if (createdSnapshotId) {
      await prisma.snapshot.deleteMany({ where: { id: createdSnapshotId } });
    }
    await app.close();
  });

  it('rejects POST with no file → 400 INVALID_UPLOAD', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-no-file')
      .field('envName', 'TEST')
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('Fichier zip manquant');
  });

  it('rejects POST with invalid MIME → 400 INVALID_UPLOAD with mimetype context', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-bad-mime')
      .field('envName', 'TEST')
      .attach('zip', Buffer.from('fake png content'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('MIME type non autorisé');
    expect(res.body.context.mimetype).toBe('image/png');
  });

  it('rejects POST with valid MIME but invalid magic bytes → 400 INVALID_UPLOAD', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-bad-magic')
      .field('envName', 'TEST')
      .attach('zip', Buffer.from([0xff, 0xff, 0xff, 0xff, 0x00, 0x00]), {
        filename: 'notzip.zip',
        contentType: 'application/zip',
      })
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('Signature ZIP invalide');
  });

  it('rejects POST with empty label → 400 INVALID_UPLOAD with Zod issues', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', '')
      .field('envName', 'TEST')
      .attach('zip', zip, { filename: 'e.zip', contentType: 'application/zip' })
      .expect(400);
    expect(res.body.code).toBe('INVALID_UPLOAD');
    expect(res.body.message).toContain('label/envName invalides');
    expect(Array.isArray(res.body.context.issues)).toBe(true);
  });

  it('accepts POST with valid zip + body → 201 with SnapshotDetail', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const res = await request(app.getHttpServer())
      .post('/api/snapshots')
      .field('label', 'TestP21-nominal')
      .field('envName', 'TEST')
      .attach('zip', zip, { filename: 'e.zip', contentType: 'application/zip' })
      .expect(201);
    createdSnapshotId = res.body.id;
    expect(res.body.label).toBe('TestP21-nominal');
    expect(res.body.envName).toBe('TEST');
    expect(res.body.componentType).toBe('ENDPOINT');
  });
});
