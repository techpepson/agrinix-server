import { HelpersService } from 'src/helpers/helpers.service';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

import { Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [CommunityController],
  providers: [CommunityService, PrismaService, HelpersService],
})
export class CommunityModule {}
