import { ProcessorModule } from './processors/processor.module';
import { GuardModule } from './guards/guard.module';
import { ImageUploadProcessor } from './processors/image-upload.service';
import { EmailProcessor } from './processors/email-processor.service';

import { CommunityModule } from './community/community.module';
import { CropModule } from './crops/crop.module';
import { HelpersModule } from './helpers/helpers.module';
import { CronService } from './jobs/cron.service';
import { HelpersService } from './helpers/helpers.service';
import { AuthModule } from './auth/auth.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { HttpModule } from '@nestjs/axios';
import { PrismaService } from './prisma/prisma.service';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { JwtService } from '@nestjs/jwt';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BullModule } from '@nestjs/bullmq';
import { CropService } from './crops/crop.service';

@Module({
  imports: [
    ProcessorModule,
    GuardModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    }),
    CommunityModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
          username: configService.get<string>('redis.userName'),
        },
        defaultJobOptions: {
          attempts: 5,
        },
      }),
      inject: [ConfigService],
    }),

    BullModule.registerQueue({
      name: 'email',
    }),
    BullModule.registerQueue({
      name: 'process-image',
    }),
    CropModule,
    HelpersModule,
    AuthModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      cache: true,
    }),
  ],
  controllers: [AppController, AuthController],
  providers: [
    CropService,
    ImageUploadProcessor,
    EmailProcessor,
    CronService,
    HelpersService,
    AppService,
    ConfigService,
    PrismaService,
    JwtService,
    AuthService,
  ],
})
export class AppModule {}
