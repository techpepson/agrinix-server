import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import ShortUniqueId from 'short-unique-id';
import nodemailer from 'nodemailer';
import path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HelpersService {
  constructor(private configService: ConfigService) {}
  logger = new Logger(HelpersService.name);

  generateUniqueId() {
    const uid = new ShortUniqueId({ length: 5, dictionary: 'alphanum' });
    return {
      id: uid.rnd(),
    };
  }

  async nodemailerSetup(
    receiver: string,
    subject: string,
    html: any,
    textBody?: string,
  ) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        auth: {
          user: this.configService.get<string>('email.user'),
          pass: this.configService.get<string>('email.password'),
        },
      });

      const info = await transporter.sendMail({
        from: 'Agrinix',
        to: receiver,
        subject: subject,
        html,
        text: textBody,
      });

      console.log(`Message sent with id ${info.messageId}`);
    } catch (error) {
      if (error.code === 'EAUTH') {
        throw new UnauthorizedException('Email authentication failed');
      }
      if (error.code === 'ESOCKET') {
        throw new ServiceUnavailableException('Email service unavailable');
      }
      this.logger.error('Failed to send email:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async renderEjs(templatePath: string, data: any) {
    try {
      const filePath = path.join(process.cwd(), 'src', 'views', templatePath);

      //check if the path exists
      if (!fs.existsSync(templatePath)) {
        throw new NotFoundException(
          `Template pathe ${templatePath} does not exist`,
        );
      }

      const renderedFile = await ejs.renderFile(filePath, data);
      return renderedFile;
    } catch (error) {
      this.logger?.error?.('Failed to render EJS template:', error);
      throw new InternalServerErrorException('Failed to render EJS template');
    }
  }
}
