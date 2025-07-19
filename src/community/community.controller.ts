import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Query,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Request } from 'express';
import { MessageDto, MessageResponseDto } from 'src/dto/message.dto';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-message')
  @UseInterceptors(FileInterceptor('messageImage'))
  async createMessage(
    @Body() message: MessageDto,
    messageId: string,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const email = (req.user as any)?.email;
    return await this.communityService.createMessage(
      message,
      email,
      messageId,
      file,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('messages')
  async fetchMessages(@Req() req: Request) {
    const email = (req.user as any)?.email;
    return await this.communityService.fetchMessages(email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-response')
  async createResponse(
    @Body() response: MessageResponseDto,
    @Req() req: Request,
  ) {
    const email = (req.user as any)?.email;
    return await this.communityService.createResponse(response, email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('user-messages')
  async fetchUserMessages(@Req() req: Request) {
    const email = (req.user as any)?.email;
    return await this.communityService.fetchUserMessages(email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('like-message')
  async likeMessage(
    @Query('messageId') messageId: string,
    @Req() req: Request,
  ) {
    const email = (req.user as any)?.email;
    return await this.communityService.LikeMessage(messageId, email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('like-response')
  async likeResponse(
    @Query('responseId') responseId: string,
    @Req() req: Request,
  ) {
    const email = (req.user as any)?.email;
    return await this.communityService.LikeResponse(responseId, email);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-message')
  async deleteMessage(
    @Query('messageId') messageId: string,
    @Req() req: Request,
  ) {
    const email = (req.user as any)?.email;
    return await this.communityService.deleteMessage(messageId, email);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-response')
  async deleteResponse(
    @Query('responseId') responseId: string,
    @Req() req: Request,
  ) {
    const email = (req.user as any)?.email;
    return await this.communityService.deleteResponse(responseId, email);
  }
}
