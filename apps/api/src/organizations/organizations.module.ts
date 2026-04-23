import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationSeederService } from './organization-seeder.service.js';
import { OrganizationsController } from './organizations.controller.js';

@Module({
  imports: [PrismaModule],
  providers: [OrganizationsService, OrganizationSeederService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
