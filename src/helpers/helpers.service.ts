import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import ShortUniqueId from 'short-unique-id';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { ConfigService } from '@nestjs/config';
import cloudinary from 'src/config/cloudinary.config';

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
      const emailUser = this.configService.get<string>('email.user');
      const emailPass = this.configService.get<string>('email.password');

      this.logger.debug({ user: emailUser, password: emailPass });

      // Debug logging
      this.logger.debug('Email config:', {
        user: emailUser ? 'Set' : 'Not set',
        pass: emailPass ? 'Set' : 'Not set',
      });

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        auth: {
          user: emailUser,
          pass: emailPass,
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
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(
          `Template path ${templatePath} does not exist`,
        );
      }

      const renderedFile = await ejs.renderFile(filePath, data);
      return renderedFile;
    } catch (error) {
      this.logger?.error?.('Failed to render EJS template:', error);
      throw new InternalServerErrorException('Failed to render EJS template');
    }
  }

  async sendEjsAsEmail(
    emailSubject: string,
    data: any,
    templatePath: any,
    emailReceiver: any,
  ) {
    const html = await this.renderEjs(templatePath, data);

    //send the email to the user
    await this.nodemailerSetup(emailReceiver, emailSubject, html);
  }

  async uploadImage(file: Express.Multer.File) {
    try {
      //check if the file has a buffer
      if (!file.buffer) {
        throw new NotFoundException('File buffer empty');
      }

      //convert the file buffer to a base64 string
      const base64String = file.buffer.toString('base64');
      const mimeType = file.mimetype;

      const dataUri = `data:${mimeType};base64,${base64String}`;

      const uploader = await cloudinary.uploader.upload(dataUri, {
        overwrite: true,
        use_filename: true,
      });
      return {
        secureUrl: uploader.secure_url,
        public_id: uploader.public_id,
        url: uploader.url,
        createdAt: uploader.created_at,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException('File buffer not found');
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException('Bad request received');
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred while uploading image',
        );
      }
      console.error(error);
    }
  }
}
