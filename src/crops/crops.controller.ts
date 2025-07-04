import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  Req,
  Body,
  Get,
  Delete,
  UseInterceptors,
} from '@nestjs/common';

import { CropService } from './crop.service';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('crops')
export class CropsController {
  constructor(private readonly cropService: CropService) {}

  @Post('detect-disease')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('crop-image'))
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

  @UseGuards(JwtAuthGuard)
  @Delete('farmer-crop')
  async deleteFarmerCrop(@Req() req: Request, @Body('cropId') cropId: string) {
    const email = (req.user as any)?.email;
    return await this.cropService.deleteFarmerCrop(cropId, email);
  }
}
