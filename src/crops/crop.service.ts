import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HelpersService } from 'src/helpers/helpers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
@Injectable()
export class CropService {
  constructor(
    private prisma: PrismaService,
    private helper: HelpersService,
    private configService: ConfigService,
    @InjectQueue('process-image') private readonly imageQueue: Queue,
    private httpService: HttpService,
  ) {}

  logger = new Logger(CropService.name);

  async detectCropDisease(file: Express.Multer.File, email: string) {
    const job = await this.imageQueue.add('process-image', {
      email,
      file,
    });

    // Return job ID for client to check status
    return {
      message: 'Image uploaded successfully. Processing in background...',
      jobId: job.id,
      status: 'processing',
    };
  }

  async getJobStatus(jobId: string) {
    const job = await this.imageQueue.getJob(jobId);

    if (!job) {
      throw new BadRequestException('Job not found');
    }

    const state = await job.getState();
    const result = await job.returnvalue;

    return {
      jobId,
      status: state,
      result: result || null,
    };
  }

  async getUserJobs(email: string) {
    // Get all jobs from the queue
    const jobs = await this.imageQueue.getJobs([
      'active',
      'waiting',
      'completed',
      'failed',
    ]);

    // Filter jobs for this user
    const userJobs = jobs.filter((job) => job.data.email === email);

    // Get detailed info for each job
    const jobDetails = await Promise.all(
      userJobs.map(async (job) => {
        const state = await job.getState();
        const result = await job.returnvalue;

        return {
          jobId: job.id,
          status: state,
          result: result || null,
          createdAt: job.timestamp,
          processedAt: job.processedOn,
          finishedAt: job.finishedOn,
        };
      }),
    );

    return jobDetails;
  }

  //method to make a call to roboflow
  async fetchRoboflowPrediction(image: string) {
    const apiKey = this.configService.get<string>('roboflow.privateKey');
    const endpoint =
      this.configService.get<string>('roboflow.endpoint') ||
      'https://serverless.roboflow.com/infer/workflows/agrinix/agrinix-workflow-3';

    if (!apiKey) {
      throw new Error('Roboflow API key is not configured.');
    }
    if (!image) {
      throw new Error('Image URL is required.');
    }

    try {
      const { data } = await this.httpService.axiosRef.post(
        endpoint,
        {
          api_key: apiKey,
          inputs: {
            image: { type: 'url', value: image },
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        },
      );

      if (!data) {
        throw new Error('No data returned from Roboflow.');
      }

      return { response: data };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `An error occurred while getting roboflow data with error ${error.message}`,
        );
      } else {
        throw new Error(
          `Failed to fetch prediction from Roboflow: ${error?.response?.data?.message || error.message}`,
        );
      }
    }
  }

  async fetchFarmerCrops(email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      //check if the user exists
      if (!user) {
        throw new ForbiddenException('User access to this endpoint forbidden');
      }

      //fetch the crops associated wit a farmer
      const crops = await this.prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          crops: {
            select: {
              name: true,
              infections: true,
            },
          },
        },
      });

      return {
        data: crops,
      };
    } catch (error) {
      console.error(error);
    }
  }

  async deleteFarmerCrop(cropId: string, email: string) {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ForbiddenException('Access forbidden for this request');
      }

      // Find the crop and ensure the user is the owner
      const crop = await this.prisma.crop.findUnique({ where: { id: cropId } });
      if (!crop) {
        throw new BadRequestException('Crop not found');
      }
      if (crop.userId !== user.id) {
        throw new ForbiddenException('You are not allowed to delete this crop');
      }

      await this.prisma.crop.delete({ where: { id: cropId } });
      return { message: 'Crop deleted successfully' };
    } catch (error) {
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

  // AI-powered disease information methods
  async getDiseaseInfoFromAI(diseaseClass: string) {
    try {
      const diseaseInfo = await this.helper.getDiseaseInfoFromAI(diseaseClass);
      return {
        success: true,
        diseaseInfo,
      };
    } catch (error) {
      this.logger.error('AI disease info failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async askAIAboutDisease(question: string, diseaseClass?: string) {
    try {
      const prompt = diseaseClass
        ? `Question: ${question}\n\nContext: This is about ${diseaseClass.replace(/_/g, ' ')} disease.`
        : question;

      const result = await this.helper.makeOpenRouterCall(prompt);
      return {
        success: true,
        response: result.response,
        usage: result.usage,
      };
    } catch (error) {
      this.logger.error('AI question failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
