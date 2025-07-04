import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
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
        await this.generateEmailToken(
          payload.email,
          payload.name,
          isUpdate,
          emailToken,
        );
      }

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

      this.logger.debug(
        `Secret keys: ${this.configService.get<string>('jwt.secret')}`,
      );
      //check if user exists
      if (!user) {
        throw new ForbiddenException('User not registered on Agrinix');
      }

      const userPassword = user.password;

      //restrict access if email is not verified
      if (!user.isEmailVerified) {
        throw new ForbiddenException('Please verify email to login');
      }

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
