import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { RegistryAdminController } from './registry-admin.controller.js';
import { RegistrySettingsService } from './registry-settings.service.js';

@Module({
  imports: [PrismaModule, RegistryModule],
  controllers: [RegistryAdminController],
  providers: [RegistrySettingsService],
  exports: [RegistrySettingsService],
})
export class RegistrySettingsModule {}
