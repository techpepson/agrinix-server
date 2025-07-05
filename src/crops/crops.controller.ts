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
  Query,
} from '@nestjs/common';

import { CropService } from './crop.service';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('crops')
export class CropsController {
  constructor(private readonly cropService: CropService) {}

  /**
   * Upload image for disease detection
   * Returns a job ID that can be used to check processing status
   */
  @UseGuards(JwtAuthGuard)
  @Post('detect-disease')
  @UseInterceptors(FileInterceptor('crop-image'))
  async detectDisease(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const email = (req.user as any)?.email;

    const result = await this.cropService.detectCropDisease(file, email);
    return {
      message: result.message,
      jobId: result.jobId,
      status: result.status,
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

  /**
   * Get the status and result of a specific job
   * @param jobId - The job ID returned from detect-disease endpoint
   */
  @UseGuards(JwtAuthGuard)
  @Get('job-status')
  async getJobStatus(@Req() req: Request, @Query('jobId') jobId: string) {
    try {
      const result = await this.cropService.getJobStatus(jobId);
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        jobId,
      };
    }
  }

  /**
   * Get all jobs for the authenticated user
   * Returns a list of all disease detection jobs with their status
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-jobs')
  async getUserJobs(@Req() req: Request) {
    const email = (req.user as any)?.email;
    try {
      const jobs = await this.cropService.getUserJobs(email);
      return {
        success: true,
        jobs,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get AI-powered disease information
   * Uses OpenRouter AI to provide detailed disease information
   */
  @UseGuards(JwtAuthGuard)
  @Post('ai/disease-info')
  async getDiseaseInfoFromAI(
    @Req() req: Request,
    @Body() body: { diseaseClass: string },
  ) {
    try {
      const result = await this.cropService.getDiseaseInfoFromAI(
        body.diseaseClass,
      );
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Ask AI about plant diseases
   * General questions about plant diseases and care
   */
  @UseGuards(JwtAuthGuard)
  @Post('ai/ask')
  async askAIAboutDisease(
    @Req() req: Request,
    @Body() body: { question: string; diseaseClass?: string },
  ) {
    try {
      const result = await this.cropService.askAIAboutDisease(
        body.question,
        body.diseaseClass,
      );
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Start a conversation with Plant.id chatbot
   * For interactive plant disease diagnosis and advice
   */

  /**
   * Send a message to Plant.id chatbot
   * For ongoing conversations about plant diseases
   */

  /**
   * Get disease information using chatbot
   * Alternative to automatic disease info fetching
   */
}
