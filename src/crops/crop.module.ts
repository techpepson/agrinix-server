import { CropService } from './crop.service';

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HelpersService } from 'src/helpers/helpers.service';
import { CropsController } from './crops.controller';

import { BullModule } from '@nestjs/bullmq';
import { ProcessorModule } from 'src/processors/processor.module';

@Module({
  imports: [
    ProcessorModule,
    HttpModule,
    BullModule.registerQueue({
      name: 'process-image',
      defaultJobOptions: { attempts: 5 },
      prefix: 'agrinix',
    }),
  ],
  controllers: [CropsController],
  providers: [CropService, PrismaService, ConfigService, HelpersService],
})
export class CropModule {}
