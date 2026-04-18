import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service.js';
import type { IngestionResult, NetworkSnapshot } from './types.js';

const STORAGE_DIR = join(process.cwd(), 'storage', 'snapshots');

@Injectable()
export class SnapshotPersisterService {
  private readonly logger = new Logger(SnapshotPersisterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async persist(
    snapshot: NetworkSnapshot,
    zipBuffer: Buffer,
    label: string,
  ): Promise<IngestionResult> {
    const snapshotId = uuid();
    const zipPath = join(STORAGE_DIR, `${snapshotId}.zip`);
    await mkdir(dirname(zipPath), { recursive: true });
    await writeFile(zipPath, zipBuffer);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.snapshot.create({
          data: {
            id: snapshotId,
            label,
            envName: snapshot.meta.envName,
            componentType: snapshot.meta.componentType,
            sourceComponentCode: snapshot.meta.sourceComponentCode,
            cdCode: snapshot.meta.cdCode,
            organization: snapshot.meta.organization,
            zipPath,
            warningsJson: JSON.stringify(snapshot.warnings),
          },
        });

        for (const c of snapshot.components) {
          await tx.component.create({
            data: {
              snapshotId,
              eic: c.eic,
              type: c.type,
              organization: c.organization,
              personName: c.personName,
              email: c.email,
              phone: c.phone,
              homeCdCode: c.homeCdCode,
              networksCsv: c.networks.join(','),
              creationTs: c.creationTs,
              modificationTs: c.modificationTs,
              displayName: c.displayName,
              country: c.country,
              lat: c.lat,
              lng: c.lng,
              isDefaultPosition: c.isDefaultPosition,
              process: c.process,
              sourceType: c.sourceType,
              urls: { create: c.urls.map((u) => ({ network: u.network, url: u.url })) },
            },
          });
        }

        if (snapshot.messagePaths.length > 0) {
          await tx.messagePath.createMany({
            data: snapshot.messagePaths.map((p) => ({
              snapshotId,
              receiverEic: p.receiverEic,
              senderEicOrWildcard: p.senderEicOrWildcard,
              messageType: p.messageType,
              transportPattern: p.transportPattern,
              intermediateBrokerEic: p.intermediateBrokerEic,
              validFrom: p.validFrom,
              validTo: p.validTo,
              process: p.process,
              direction: p.direction,
              source: p.source,
              isExpired: p.isExpired,
            })),
          });
        }

        if (snapshot.messagingStats.length > 0) {
          await tx.messagingStatistic.createMany({
            data: snapshot.messagingStats.map((s) => ({
              snapshotId,
              sourceEndpointCode: snapshot.meta.sourceComponentCode,
              remoteComponentCode: s.remoteComponentCode ?? '',
              connectionStatus: s.connectionStatus,
              lastMessageUp: s.lastMessageUp,
              lastMessageDown: s.lastMessageDown,
              sumMessagesUp: s.sumMessagesUp ?? 0,
              sumMessagesDown: s.sumMessagesDown ?? 0,
              deleted: s.deleted ?? false,
            })),
          });
        }

        if (snapshot.appProperties.length > 0) {
          await tx.appProperty.createMany({
            data: this.filterSensitive(snapshot.appProperties).map((p) => ({
              snapshotId,
              key: p.key,
              value: p.value ?? '',
            })),
          });
        }
      });
    } catch (err) {
      await unlink(zipPath).catch((e: Error) => {
        this.logger.warn(`Failed to cleanup orphaned zip ${zipPath}: ${e.message}`);
      });
      throw err;
    }

    return {
      snapshotId,
      componentType: snapshot.meta.componentType,
      sourceComponentCode: snapshot.meta.sourceComponentCode,
      cdCode: snapshot.meta.cdCode,
      warnings: snapshot.warnings,
    };
  }

  private filterSensitive(
    props: NetworkSnapshot['appProperties'],
  ): NetworkSnapshot['appProperties'] {
    const deny = /password|secret|keystore\.password|privateKey|credentials/i;
    return props.filter((p) => !deny.test(p.key));
  }
}
