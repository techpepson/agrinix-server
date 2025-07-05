/*
https://docs.nestjs.com/modules
*/

import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [],
  controllers: [],
  providers: [JwtAuthGuard],
})
export class GuardModule {}
