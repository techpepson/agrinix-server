import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MessageDto {
  @IsString()
  @IsNotEmpty()
  messageTitle: string;

  @IsString()
  @IsNotEmpty()
  messageBody: string;

  @IsString()
  @IsOptional()
  messageImage?: string;

  @IsString()
  @IsOptional()
  messageLink?: string;
}

export class MessageResponseDto {
  @IsString()
  @IsNotEmpty()
  responseBody: string;

  @IsString()
  @IsNotEmpty()
  messageId: string;
}
