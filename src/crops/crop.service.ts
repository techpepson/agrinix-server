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

@Injectable()
export class CropService {
  constructor(
    private prisma: PrismaService,
    private helper: HelpersService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  logger = new Logger(CropService.name);
  async detectCropDisease(file: Express.Multer.File, email: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: {
          email,
        },
      });

      //check if the user exists
      if (!user) {
        throw new ForbiddenException('Access forbidden for this request');
      }

      // Input validation: check file presence
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
      // Input validation: check file type (accept only images)
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Uploaded file must be an image');
      }
      // Input validation: check file size (e.g., max 5MB)
      const MAX_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        throw new BadRequestException('Image size must be less than 5MB');
      }

      //upload image to cloudinary
      const image = await this.helper.uploadImage(file);

      //invoke the roboflow api method
      const prediction = await this.fetchRoboflowPrediction(image.secureUrl);

      // Validate Roboflow response structure
      const outputs = prediction?.response?.response?.outputs;
      if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
        return {
          message:
            'Oops! Our model could not predict this. Please try again with a clearer image',
        };
      }
      const modelPrediction = outputs[0]?.model_prediction_output;
      if (
        !modelPrediction ||
        !modelPrediction.predictions ||
        !Array.isArray(modelPrediction.predictions) ||
        modelPrediction.predictions.length === 0
      ) {
        return {
          message:
            'No disease prediction found. Please try again with a clearer image',
        };
      }

      const filteredCropName = '';
      const diseaseClass = modelPrediction.predictions[0].class;
      const diseaseTop = modelPrediction.top;
      const predictionConfidence = modelPrediction.top;
      const inferenceId = modelPrediction.top;
      const imageWidth = modelPrediction.image.width;
      const imageHeight = modelPrediction.image.height;

      //save the prediction to the database against the farmer name
      await this.prisma.user.update({
        where: { email },
        data: {
          crops: {
            create: {
              name: filteredCropName,
              infections: {
                create: {
                  diseaseClass,
                  diseaseTop,
                  diseaseDescription: '',
                  diseaseCauses: [],
                  diseasePrevention: [],
                  diseaseSymptoms: [],
                  diseasePredictionConfidence: predictionConfidence,
                  inferenceId,
                  accuracy: predictionConfidence,
                  diseaseImages: {
                    create: {
                      imageUrl: Array.from(image.secureUrl),
                      imageWidth,
                      imageHeight,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return {
        message: 'Model prediction successful',
        response: prediction.response,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException(
          'User forbidden from performing this request',
        );
      } else if (error instanceof BadRequestException) {
        throw error;
      } else {
        throw new InternalServerErrorException(
          'An internal server error occurred while fetching predictions.',
        );
      }
    }
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
}
