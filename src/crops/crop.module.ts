import { CropService } from './crop.service';

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HelpersService } from 'src/helpers/helpers.service';
import { CropsController } from './crops.controller';

@Module({
  imports: [HttpModule],
  controllers: [CropsController],
  providers: [CropService, PrismaService, ConfigService, HelpersService],
})
export class CropModule {}
