/*
https://docs.nestjs.com/providers#services
*/

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HelpersService } from 'src/helpers/helpers.service';
import { ConfigService } from '@nestjs/config';

@Processor('email')
@Injectable()
export class EmailProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly helpers: HelpersService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>) {
    // Expect job.data to have: email, name, isUpdating, token
    const { email, name, isUpdating, token } = job.data;

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      let newToken: string | undefined = token;

      // Store the user token in the database if updating
      if (isUpdating) {
        newToken = this.helpers.generateUniqueId().id;
        await this.prisma.user.update({
          where: { email },
          data: { emailToken: newToken },
        });

        job.data.name = user?.name;
      }

      const emailSubject = 'Email Verification Token';
      const baseUrl = this.configService.get<string>('appEnv.baseUrl');
      const url = `${baseUrl}/auth/verify-email?verificationId=${newToken}&email=${email}`;

      const data = {
        userName: name,
        verificationId: newToken,
        verificationUrl: url,
      };
      const templatePath = 'email.verify.ejs';
      const emailReceiver = email;

      // Send an email to the user
      await this.helpers.sendEjsAsEmail(
        emailSubject,
        data,
        templatePath,
        emailReceiver,
      );
    } catch (error) {
      console.error(error);
      if (error instanceof NotFoundException) {
        throw new NotFoundException('User account not found.');
      } else if (error instanceof ConflictException) {
        throw new ConflictException('A conflict exception occurred.');
      } else if (error instanceof ForbiddenException) {
        throw new ForbiddenException('User access forbidden.');
      } else if (error instanceof UnauthorizedException) {
        throw new UnauthorizedException(
          'Email authentication failed. Please check your email configuration.',
        );
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred.',
        );
      }
    }
  }
}
