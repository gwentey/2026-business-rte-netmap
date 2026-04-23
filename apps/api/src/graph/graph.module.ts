import { Module } from '@nestjs/common';
import { RegistrySettingsModule } from '../registry-settings/registry-settings.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { GraphController } from './graph.controller.js';
import { GraphService } from './graph.service.js';

@Module({
  imports: [RegistrySettingsModule, OrganizationsModule],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
