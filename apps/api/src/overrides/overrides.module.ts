import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { OverridesController } from './overrides.controller.js';
import { OverridesService } from './overrides.service.js';

@Module({
  imports: [PrismaModule, RegistryModule, OrganizationsModule],
  controllers: [OverridesController],
  providers: [OverridesService],
  exports: [OverridesService],
})
export class OverridesModule {}
