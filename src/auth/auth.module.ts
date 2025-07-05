import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
// import { jwtConstants } from './constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { HelpersService } from 'src/helpers/helpers.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { EmailProcessor } from 'src/processors/email-processor.service';
import { BullModule } from '@nestjs/bullmq';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
      defaultJobOptions: { attempts: 3 },
      prefix: 'agrinix',
    }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    HelpersService,
    ConfigService,
    JwtStrategy,
    EmailProcessor,
  ],
})
export class AuthModule {}
