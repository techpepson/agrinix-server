import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LoginDto, RegisterDto } from 'src/dto/auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { HelpersService } from 'src/helpers/helpers.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class AuthService {
  constructor(
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

      //store the user in the database
      await this.prisma.$transaction(async (tx) => {
        await tx.user.upsert({
          where: {
            email: payload.email,
          },
          create: {
            email: payload.email,
            password: hashedPassword,
            name: payload.name,
          },
          update: {
            email: payload.email,
            password: hashedPassword,
            name: payload.name,
          },
        });

        //send an email to the user if they are creating an account for the first time
        if (!isUpdate) {
          await this.generateEmailToken(payload.email);
        }
      });

      return {
        message: 'Account created successfully.Please verify email.',
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof ConflictException) {
        throw new ConflictException('User already exists');
      } else {
        throw new InternalServerErrorException(
          'An error occurred while creating account',
        );
      }
    }
  }

  async emailLogin(payload: LoginDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email: payload.email,
        },
      });

      //check if user exists
      if (!user) {
        throw new ForbiddenException('Access not allowed');
      }

      const userPassword = user.password;

      //compare account passwords
      const isPasswordMatch = await argon.verify(
        userPassword,
        payload.password,
      );

      if (!isPasswordMatch) {
        throw new ForbiddenException('Passwords do not match');
      }

      //sign user token
      const token = this.jwt.sign({ email: user.email, id: user.id });

      return {
        message: 'Login Successful',
        token,
      };
    } catch (error) {
      this.logger.error(error);
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException('Invalid credentials');
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred',
        );
      }
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

      //check if email token is same with id
      if (id !== emailVerificationId || user.emailToken === null) {
        const baseUrl = this.configService.get<string>('appEnv.baseUrl');
        this.httpService.get(`${baseUrl}/generate-email-token?email=${email}`);
        return {
          message: 'Email token did not match so a new token was generated',
        };
      } else {
        return {
          verificationStatus: 'Success',
        };
      }
    } catch (error) {
      console.error(error);
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

  async generateEmailToken(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      //check if user exists
      if (!user) {
        throw new ForbiddenException('Access denied to this service');
      }

      //generate the id
      const uniqueId = this.helpers.generateUniqueId().id;

      //store the user token in the database
      await this.prisma.user.update({
        where: {
          email,
        },
        data: {
          emailToken: uniqueId,
        },
      });

      const emailSubject = 'Email Verification Token';
      const url = this.configService.get<string>(
        `appEnv.baseUrl/verify-email?verificationId=${uniqueId}&email=${email}`,
      );

      const data = {
        userName: user.name,
        verificationId: uniqueId,
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
      console.error(error);
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
}
