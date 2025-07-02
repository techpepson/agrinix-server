import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MessageDto, MessageResponseDto } from 'src/dto/message.dto';
import { HelpersService } from 'src/helpers/helpers.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CommunityService {
  logger = new Logger(CommunityService.name);
  constructor(
    private prisma: PrismaService,
    private helpers: HelpersService,
  ) {}

  async createMessage(
    message: MessageDto,
    email: string,
    file: Express.Multer.File,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      let messageImage: string;

      //check if the user exists before sending the message
      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      //create a transaction to send the message
      await this.prisma.$transaction(async (tx) => {
        if (file) {
          if (file.buffer.length == 0) {
            throw new BadRequestException('Buffer length is empty');
          }
          const MAX_SIZE = 5 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
            throw new BadRequestException('Image size greater than 5MB');
          }

          //upload the image to cloudinary
          const image = await this.helpers.uploadImage(file);
          messageImage = image.secureUrl;
        }

        //update the user with the new message
        await tx.user.update({
          where: {
            email,
          },
          data: {
            message: {
              create: {
                messageTitle: message.messageTitle,
                messageBody: message.messageBody,
                messageImage: messageImage ?? null,
              },
            },
          },
        });
      });

      return {
        message: 'Message sent successfully',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException('Access forbidden for this service.');
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException('Invalid request sent');
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException(
          'A prisma error occurred. Please try again later',
        );
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred',
        );
      }
    }
  }

  async fetchMessages(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      const messages = await this.prisma.message.findMany({
        orderBy: {
          messageCreatedAt: 'desc',
        },
      });

      return messages;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException('Access forbidden for this service.');
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred',
        );
      }
    }
  }

  async createResponse(response: MessageResponseDto, email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      //check if the user exists
      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      //check if the message exists

      const message = await this.prisma.message.findUnique({
        where: {
          id: response.messageId,
        },
      });

      //check if the message exists
      if (!message) {
        throw new BadRequestException('Message not found');
      }

      //create a transaction to send the response
      await this.prisma.$transaction(async (tx) => {
        //update the message with the new response
        await tx.message.update({
          where: {
            id: response.messageId,
          },
          data: {
            messageResponses: {
              create: {
                responseBody: response.responseBody,
                responseAuthor: {
                  connect: {
                    email,
                  },
                },
              },
            },
          },
        });
      });

      return {
        message: 'Response sent successfully',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException('Access forbidden for this service.');
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException('Invalid request sent');
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException(
          'A prisma error occurred. Please try again later',
        );
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred',
        );
      }
    }
  }

  async fetchUserMessages(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (!user) {
        throw new ForbiddenException('Access forbidden');
      }

      //fetch the messages associated with a person
      const messages = await this.prisma.message.findMany({
        where: {
          author: {
            email,
          },
        },
      });

      return messages;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException('Invalid request sent');
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException(
          'A prisma error occurred. Please try again later',
        );
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred',
        );
      }
    }
  }

  async LikeMessage(messageId: number, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      //check if the user exists
      if (!user)
        throw new ForbiddenException('Access forbidden for this service.');

      const response = await this.prisma.response.findUnique({
        where: { id: messageId },
      });
      if (!response) throw new NotFoundException('Response not found');

      // Check if already liked
      //   const alreadyLiked = await this.prisma.responseLike.findUnique({
      //     where: {
      //       messageId: { userId: user.id, messageId },
      //     },
      //   });
      //   if (alreadyLiked) {
      //     throw new BadRequestException('You have already liked this response');
      //   }

      await this.prisma.message.update({
        where: {
          id: messageId,
        },
        data: {
          messageLikes: {
            increment: 1,
          },
        },
      });

      return { message: 'Response liked successfully' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      else if (error instanceof NotFoundException)
        throw new NotFoundException('Message not found');
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }
  async LikeResponse(responseId: number, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user)
        throw new ForbiddenException('Access forbidden for this service.');

      const response = await this.prisma.response.findUnique({
        where: { id: responseId },
      });
      if (!response) throw new BadRequestException('Response not found');

      // Check if already liked
      //   const alreadyLiked = await this.prisma.responseLike.findUnique({
      //     where: {
      //       userId_responseId: { userId: user.id, responseId },
      //     },
      //   });
      //   if (alreadyLiked) {
      //     throw new BadRequestException('You have already liked this response');
      //   }

      await this.prisma.response.update({
        where: {
          id: responseId,
        },
        data: {
          responseLikes: {
            increment: 1,
          },
        },
      });

      return { message: 'Response liked successfully' };
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      )
        throw error;
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }
}
