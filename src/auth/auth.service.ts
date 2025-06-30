import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { LoginDto, RegisterDto } from 'src/dto/auth.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as argon from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { HelpersService } from 'src/helpers/helpers.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private helpers: HelpersService,
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
        const verificationId = this.helpers.generateUniqueId();
        await tx.user.upsert({
          where: {
            email: payload.email,
          },
          create: {
            email: payload.email,
            password: hashedPassword,
            name: payload.name,
            emailToken: verificationId.id,
          },
          update: {
            email: payload.email,
            password: hashedPassword,
            name: payload.name,
          },
        });

        //send an email to the user if they are creating an account for the first time
        if (!isUpdate) {
          const receiver = payload.email;
          const subject = 'Email verification';
          const tempPath = 'email.verify.ejs';
          const userName = payload.name;

          const verificationUrl = '';
          const data = { userName, verificationId, verificationUrl };
          const html = this.helpers.renderEjs(tempPath, data);

          //send the email to the user
          await this.helpers.nodemailerSetup(receiver, subject, html);
        }
      });

      return {
        message: 'Account created successfully',
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

  async verifyEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    //check if user exists
    if (!user) {
      throw new ForbiddenException('User account not found');
    }
  }
  //   async googleAuth() {}
}
