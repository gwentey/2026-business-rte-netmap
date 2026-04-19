import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EnvsController } from './envs.controller.js';
import { EnvsService } from './envs.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [EnvsController],
  providers: [EnvsService],
})
export class EnvsModule {}
