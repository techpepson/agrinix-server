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
    messageId?: string,
    file?: Express.Multer.File,
  ) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      let messageImage: string;

      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      await this.prisma.$transaction(async (tx) => {
        if (file) {
          if (file.buffer.length == 0) {
            throw new BadRequestException('Buffer length is empty');
          }
          const MAX_SIZE = 5 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
            throw new BadRequestException('Image size greater than 5MB');
          }

          const image = await this.helpers.uploadImage(file);
          messageImage = image.secureUrl;
        }

        if (messageId) {
          await tx.message.update({
            where: { id: messageId },
            data: {
              messageTitle: message.messageTitle,
              messageBody: message.messageBody,
              messageImage: messageImage ?? null,
            },
          });
        } else {
          await tx.message.create({
            data: {
              messageTitle: message.messageTitle,
              messageBody: message.messageBody,
              messageImage: messageImage ?? null,
              author: { connect: { id: user.id } },
            },
          });
        }
      });

      return {
        message: 'Message sent successfully',
      };
    } catch (error) {
      this.logger.error('Error in createMessage:', error);
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException('Access forbidden for this service.');
      } else if (error instanceof BadRequestException) {
        throw error;
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error('Prisma error details:', error);
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
        include: {
          messageResponses: {
            include: {
              responseAuthor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // Get like status for each message for the current user
      const messagesWithLikeStatus = await Promise.all(
        messages.map(async (message) => {
          const userLike = await this.prisma.messageLike.findUnique({
            where: {
              userId_messageId: {
                userId: user.id,
                messageId: message.id,
              },
            },
          });

          return {
            ...message,
            hasUserLiked: !!userLike,
          };
        }),
      );

      return messagesWithLikeStatus;
    } catch (error) {
      this.logger.error('Error in fetchMessages:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error('Prisma error details:', error);
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

  async createResponse(response: MessageResponseDto, email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      const message = await this.prisma.message.findUnique({
        where: { id: response.messageId },
      });

      if (!message) {
        throw new BadRequestException('Message not found');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.message.update({
          where: { id: response.messageId },
          data: {
            messageResponses: {
              create: {
                responseBody: response.responseBody,
                responseAuthor: { connect: { id: user.id } },
              },
            },
          },
        });
      });

      return {
        message: 'Response sent successfully',
      };
    } catch (error) {
      this.logger.error('Error in createResponse:', error);
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException('Access forbidden for this service.');
      } else if (error instanceof BadRequestException) {
        throw error;
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error('Prisma error details:', error);
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

      const messages = await this.prisma.message.findMany({
        where: {
          author: {
            id: user.id,
          },
        },
        include: {
          messageResponses: true,
          author: true,
        },
      });

      return messages;
    } catch (error) {
      this.logger.error('Error in fetchUserMessages:', error);
      if (error instanceof ForbiddenException) {
        throw error;
      } else if (error instanceof BadRequestException) {
        throw error;
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error('Prisma error details:', error);
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

  async LikeMessage(messageId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user)
        throw new ForbiddenException('Access forbidden for this service.');

      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });
      if (!message) throw new NotFoundException('Message not found');

      // Check if user has already liked this message
      const existingLike = await this.prisma.messageLike.findUnique({
        where: {
          userId_messageId: {
            userId: user.id,
            messageId: messageId,
          },
        },
      });

      if (existingLike) {
        // User has already liked this message, remove the like (unlike)
        await this.prisma.$transaction(async (tx) => {
          await tx.messageLike.delete({
            where: {
              userId_messageId: {
                userId: user.id,
                messageId: messageId,
              },
            },
          });

          await tx.message.update({
            where: { id: messageId },
            data: {
              messageLikes: {
                decrement: 1,
              },
            },
          });
        });

        return { message: 'Message unliked successfully' };
      } else {
        // User hasn't liked this message yet, add the like
        await this.prisma.$transaction(async (tx) => {
          await tx.messageLike.create({
            data: {
              userId: user.id,
              messageId: messageId,
            },
          });

          await tx.message.update({
            where: { id: messageId },
            data: {
              messageLikes: {
                increment: 1,
              },
            },
          });
        });

        return { message: 'Message liked successfully' };
      }
    } catch (error) {
      this.logger.error('Error in LikeMessage:', error);
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      } else if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }
  async LikeResponse(responseId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user)
        throw new ForbiddenException('Access forbidden for this service.');

      const response = await this.prisma.response.findUnique({
        where: { id: responseId },
      });
      if (!response) throw new BadRequestException('Response not found');

      // Check if user has already liked this response
      const existingLike = await this.prisma.responseLike.findUnique({
        where: {
          userId_responseId: {
            userId: user.id,
            responseId: responseId,
          },
        },
      });

      if (existingLike) {
        // User has already liked this response, remove the like (unlike)
        await this.prisma.$transaction(async (tx) => {
          await tx.responseLike.delete({
            where: {
              userId_responseId: {
                userId: user.id,
                responseId: responseId,
              },
            },
          });

          await tx.response.update({
            where: { id: responseId },
            data: {
              responseLikes: {
                decrement: 1,
              },
            },
          });
        });

        return { message: 'Response unliked successfully' };
      } else {
        // User hasn't liked this response yet, add the like
        await this.prisma.$transaction(async (tx) => {
          await tx.responseLike.create({
            data: {
              userId: user.id,
              responseId: responseId,
            },
          });

          await tx.response.update({
            where: { id: responseId },
            data: {
              responseLikes: {
                increment: 1,
              },
            },
          });
        });

        return { message: 'Response liked successfully' };
      }
    } catch (error) {
      this.logger.error('Error in LikeResponse:', error);
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

  async deleteMessage(messageId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      // Find the message and ensure the user is the author
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });
      if (!message) {
        throw new BadRequestException('Message not found');
      }
      if (message.authorId !== user.id) {
        throw new ForbiddenException(
          'You are not allowed to delete this message',
        );
      }

      await this.prisma.message.delete({
        where: { id: messageId },
      });

      return { message: 'Message deleted successfully' };
    } catch (error) {
      this.logger.error('Error in deleteMessage:', error);
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }

  async deleteResponse(responseId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      // Find the message and ensure the user is the author
      const response = await this.prisma.response.findUnique({
        where: { id: responseId },
      });
      if (!response) {
        throw new BadRequestException('Message not found');
      }
      if (response.responseAuthorId !== user.id) {
        throw new ForbiddenException(
          'You are not allowed to delete this response',
        );
      }

      await this.prisma.response.delete({
        where: { id: responseId },
      });

      return { message: 'Response deleted successfully' };
    } catch (error) {
      this.logger.error('Error in deleteResponse:', error);
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }

  // Helper method to check if user has liked a message
  async hasUserLikedMessage(messageId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      const like = await this.prisma.messageLike.findUnique({
        where: {
          userId_messageId: {
            userId: user.id,
            messageId: messageId,
          },
        },
      });

      return { hasLiked: !!like };
    } catch (error) {
      this.logger.error('Error in hasUserLikedMessage:', error);
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }

  // Helper method to check if user has liked a response
  async hasUserLikedResponse(responseId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      const like = await this.prisma.responseLike.findUnique({
        where: {
          userId_responseId: {
            userId: user.id,
            responseId: responseId,
          },
        },
      });

      return { hasLiked: !!like };
    } catch (error) {
      this.logger.error('Error in hasUserLikedResponse:', error);
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }

  // Helper method to get message with like status for a user
  async getMessageWithLikeStatus(messageId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ForbiddenException('Access forbidden for this service.');
      }

      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          messageResponses: {
            include: {
              responseAuthor: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      // Check if user has liked this message
      const userLike = await this.prisma.messageLike.findUnique({
        where: {
          userId_messageId: {
            userId: user.id,
            messageId: messageId,
          },
        },
      });

      return {
        ...message,
        hasUserLiked: !!userLike,
      };
    } catch (error) {
      this.logger.error('Error in getMessageWithLikeStatus:', error);
      if (
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'An internal server error occurred',
      );
    }
  }
}
