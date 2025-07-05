/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { HelpersService } from 'src/helpers/helpers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ImageUploadProcessor } from './image-upload.service';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'process-image',
    }),
  ],
  controllers: [],
  providers: [
    HelpersService,
    PrismaService,
    ImageUploadProcessor,
    ConfigService,
  ],
})
export class ProcessorModule {}
