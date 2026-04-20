import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module.js';
import { RegistryModule } from './registry/registry.module.js';
import { IngestionModule } from './ingestion/ingestion.module.js';
import { GraphModule } from './graph/graph.module.js';
import { EnvsModule } from './envs/envs.module.js';
import { OverridesModule } from './overrides/overrides.module.js';
import { AdminModule } from './admin/admin.module.js';
import { RegistrySettingsModule } from './registry-settings/registry-settings.module.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    RegistryModule,
    IngestionModule,
    GraphModule,
    EnvsModule,
    OverridesModule,
    AdminModule,
    RegistrySettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
