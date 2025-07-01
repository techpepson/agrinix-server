import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  Req,
  Body,
  Get,
} from '@nestjs/common';

import { CropService } from './crop.service';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';

@Controller('crops')
export class CropsController {
  constructor(private readonly cropService: CropService) {}

  @UseGuards(JwtAuthGuard)
  @Post('detect-disease')
  async detectDisease(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const email = (req.user as any)?.email;
    await this.cropService.detectCropDisease(file, email);
    return {
      message: 'Disease detection successful',
    };
  }

  @Post('roboflow-detect-disease')
  async detectDiseaseFromRoboflow(
    @Req() req: Request,
    @Body('image') image: string,
  ) {
    const response = await this.cropService.fetchRoboflowPrediction(image);
    return {
      message: 'Disease detection successful',
      response,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('farmer-crops')
  async fetchFarmerCrops(@Req() req: Request) {
    const email = (req.user as any)?.email;
    return await this.cropService.fetchFarmerCrops(email);
  }
}
