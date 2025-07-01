import { Module } from '@nestjs/common';
import { HelpersService } from './helpers.service';
import { ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [HelpersService, ConfigService],
})
export class HelpersModule {}
