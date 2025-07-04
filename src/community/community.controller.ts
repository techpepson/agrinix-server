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
  @Post('message')
  @UseInterceptors(FileInterceptor('image'))
  async createMessage(
    @Body() message: MessageDto,
    messageId: string,
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const email = (req.user as any)?.email;
    return await this.communityService.createMessage(
      message,
      messageId,
      email,
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
  @Post('message/response')
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
  @Post('message')
  async likeMessage(@Query('id') messageId: string, @Req() req: Request) {
    const email = (req.user as any)?.email;
    return await this.communityService.LikeMessage(messageId, email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('response')
  async likeResponse(@Query('id') responseId: string, @Req() req: Request) {
    const email = (req.user as any)?.email;
    return await this.communityService.LikeResponse(responseId, email);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('message')
  async deleteMessage(@Query('id') messageId: string, @Req() req: Request) {
    const email = (req.user as any)?.email;
    return await this.communityService.deleteMessage(messageId, email);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('message')
  async deleteResponse(@Query('id') responseId: string, @Req() req: Request) {
    const email = (req.user as any)?.email;
    return await this.communityService.deleteResponse(responseId, email);
  }
}
