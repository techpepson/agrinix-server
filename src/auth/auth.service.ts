import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PreconditionFailedException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto, RegisterDto } from 'src/dto/auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { HelpersService } from 'src/helpers/helpers.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AuthService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private prisma: PrismaService,
    private jwt: JwtService,
    private helpers: HelpersService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}
  logger = new Logger(AuthService.name);

  async emailRegister(payload: RegisterDto, isUpdate: boolean = false) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: payload.email,
        },
      });

      //check if user exists
      if (user) {
        throw new ConflictException('User already exists');
      }

      //hash password
      const userPassword = payload.password;

      const hashedPassword = await argon.hash(userPassword);

      const emailToken = this.helpers.generateUniqueId().id;

      //store the user in the database
      await this.prisma.$transaction(async (tx) => {
        await tx.user.upsert({
          where: {
            email: payload.email,
          },
          update: {
            email: payload.email,

            password: hashedPassword,
            name: payload.name,
          },
          create: {
            email: payload.email,
            password: hashedPassword,
            name: payload.name,
            emailToken,
          },
        });
      });

      //send an email to the user if they are creating an account for the first time
      if (!isUpdate) {
        const emailJob = await this.emailQueue.add('sendEmail', {
          email: payload.email,
          name: payload.name,
          isUpdating: isUpdate,
          token: emailToken,
        });

        const jobId = emailJob.id;
        console.log(jobId);
      }

      return {
        message: 'Account created successfully.Please verify email.',
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof ConflictException) {
        throw error;
      } else {
        throw new ServiceUnavailableException(
          'Oops! Our Servers are currently unavailable.',
        );
      }
    }
  }

  async emailLogin(payload: LoginDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        throw new UnauthorizedException('User not registered on Agrinix');
      }

      // if (!user.isEmailVerified) {
      //   throw new PreconditionFailedException('Please verify email to login');
      // }

      const isPasswordMatch = await argon.verify(
        user.password,
        payload.password,
      );

      if (!isPasswordMatch) {
        throw new UnauthorizedException('Passwords do not match');
      }

      // First time login logic
      const hasLoggedInBefore = user.hasLoggedInBefore;
      if (hasLoggedInBefore == false) {
        await this.prisma.user.update({
          where: { email: payload.email },
          data: { hasLoggedInBefore: true },
        });
      }

      const token = await this.jwt.signAsync(
        { email: user.email, id: user.id },
        { secret: this.configService.get<string>('jwt.secret') },
      );

      return {
        message: 'Login Successful',
        token,
        hasLoggedInBefore,
        userId: user.id,
      };
    } catch (error) {
      // If it's a known HTTP exception, rethrow it so NestJS can handle it
      if (
        error instanceof UnauthorizedException ||
        error instanceof PreconditionFailedException
      ) {
        throw error;
      }
      // Log unexpected errors
      this.logger.error(error);
      // For all other errors, return a generic server error
      throw new ServiceUnavailableException(
        'Oops! Our servers are currently unavailable.',
      );
    }
  }

  async verifyEmail(email: string, id: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      //check if user exists
      if (!user) {
        throw new ForbiddenException('User account not found');
      }

      //extract the verification id from  the database
      const emailVerificationId = user.emailToken;

      if (!emailVerificationId) {
        throw new NotFoundException('Email token not found or removed.');
      }

      if (
        typeof id !== 'string' ||
        typeof emailVerificationId !== 'string' ||
        id.trim() !== emailVerificationId.trim()
      ) {
        const baseUrl = this.configService.get<string>('appEnv.baseUrl');
        this.httpService.get(`${baseUrl}/generate-email-token?email=${email}`);
        return {
          message: 'Email token did not match so a new token was generated',
        };
      } else {
        //update the verification status
        await this.prisma.user.update({
          where: {
            email,
          },
          data: {
            isEmailVerified: true,
          },
        });
        return {
          verificationStatus: 'Email verified successfully',
        };
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('User account not found.');
      } else if (error instanceof ConflictException) {
        throw new ConflictException('A conflict exception occurred.');
      } else if (error instanceof ForbiddenException) {
        throw new ForbiddenException('User access forbidden.');
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred.',
        );
      }
    }
  }
  //   async googleAuth() {}

  async generateEmailToken(
    email: string,
    name?: string,
    isUpdating?: boolean,
    token?: string,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      let newToken: any;

      //store the user token in the database
      if (isUpdating) {
        newToken = this.helpers.generateUniqueId().id;
        await this.prisma.user.update({
          where: {
            email,
          },
          data: {
            emailToken: newToken,
          },
        });

        name = user?.name;
      }

      const emailSubject = 'Email Verification Token';
      const baseUrl = this.configService.get<string>('appEnv.baseUrl');
      const url = `${baseUrl}/auth/verify-email?verificationId=${token ?? newToken}&email=${email}`;

      const data = {
        userName: name,
        verificationId: token,
        verificationUrl: url,
      };
      const templatePath = 'email.verify.ejs';
      const emailReceiver = email;

      //send an email to the user
      await this.helpers.sendEjsAsEmail(
        emailSubject,
        data,
        templatePath,
        emailReceiver,
      );
    } catch (error) {
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
