import { CronService } from './jobs/cron.service';
import { HelpersService } from './helpers/helpers.service';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
  ],
  controllers: [AppController],
  providers: [CronService, HelpersService, AppService],
})
export class AppModule {}
