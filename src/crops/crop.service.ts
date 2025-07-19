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
  private logger = new Logger(CropService.name);

  constructor(
    private prisma: PrismaService,
    private helper: HelpersService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  async detectCropDisease(file: Express.Multer.File, email: string) {
    try {
      this.logger.debug(file);
      // Validate user
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new ForbiddenException('Access forbidden for this request');
      }
      // Validate file
      if (!file) {
        throw new BadRequestException('No file uploaded');
      }
      // if (!file.mimetype.startsWith('image/')) {
      //   throw new BadRequestException('Uploaded file must be an image');
      // }
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        throw new BadRequestException('Image size must be less than 5MB');
      }
      // Upload image
      const imageResult = await this.helper.uploadImage(file);
      // Call prediction API
      const prediction = await this.fetchRoboflowPrediction(
        imageResult.secureUrl,
      );
      const outputs = prediction?.response?.outputs;
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
      // Extract prediction details
      const diseaseClass: string = modelPrediction.predictions[0].class;
      const splitDiseaseClass = diseaseClass.split('_');
      const capitalizedDiseaseClass =
        splitDiseaseClass[0].charAt(0).toUpperCase() +
        splitDiseaseClass[0].slice(1) +
        ' ' +
        splitDiseaseClass.slice(1).join('_');
      const cropName = diseaseClass.split('_')[0];
      const healthyCropName = diseaseClass.split('_')[1];
      const capitalizedCropName =
        cropName.charAt(0).toUpperCase() + cropName.slice(1);
      const capitalizedCropNameWhenHealthy = healthyCropName
        ? healthyCropName.charAt(0).toUpperCase() + healthyCropName.slice(1)
        : '';
      const isHealthy = splitDiseaseClass[0] == 'healthy';
      const filteredCropName = isHealthy
        ? capitalizedCropNameWhenHealthy
        : capitalizedCropName || 'Unknown';
      const diseaseTop = modelPrediction.top;
      const predictionConfidence =
        parseFloat(modelPrediction.confidence) || 1.0;
      const inferenceId = modelPrediction.inference_id;
      const imageWidth = parseInt(modelPrediction.image.width) || 0;
      const imageHeight = parseInt(modelPrediction.image.height) || 0;
      this.logger.log(
        `Extracted values - Confidence: ${modelPrediction.confidence} -> ${predictionConfidence}`,
      );
      this.logger.log(
        `Image dimensions - Width: ${modelPrediction.image.width} -> ${imageWidth}, Height: ${modelPrediction.image.height} -> ${imageHeight}`,
      );
      // Get disease info from AI or fallback
      let diseaseInfo: any = null;
      try {
        diseaseInfo = await this.helper.getDiseaseInfoFromAI(diseaseClass);
      } catch (e) {
        this.logger.warn('AI disease info fetch failed, using fallback.');
        throw e;
      }
      const fallbackDiseaseInfo = {
        description: `Information about ${capitalizedDiseaseClass} disease`,
        causes: ['Environmental factors', 'Pathogen infection'],
        symptoms: [
          'Visible damage to plant tissue',
          'Abnormal growth patterns',
        ],
        prevention: ['Good agricultural practices', 'Regular monitoring'],
        treatment: ['Remove infected plants', 'Apply appropriate treatments'],
      };
      const finalDiseaseInfo = diseaseInfo || fallbackDiseaseInfo;
      // Save prediction to DB
      try {
        await this.prisma.user.update({
          where: { email },
          data: {
            crops: {
              create: {
                name: filteredCropName,
                infections: {
                  create: {
                    diseaseClass: capitalizedDiseaseClass,
                    diseaseTop,
                    diseaseDescription: finalDiseaseInfo.description,
                    diseaseCauses: finalDiseaseInfo.causes,
                    diseasePrevention: finalDiseaseInfo.prevention,
                    diseaseSymptoms: finalDiseaseInfo.symptoms,
                    diseasePredictionConfidence: predictionConfidence,
                    inferenceId,
                    accuracy: predictionConfidence,
                    diseaseImages: {
                      create: {
                        imageUrl: [imageResult.secureUrl],
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
      } catch (dbError) {
        this.logger.error('Database error:', dbError);
        throw new InternalServerErrorException(
          'Failed to save prediction to database',
        );
      }
      return {
        message: 'Model prediction successful',
        response: prediction.response,
        class: capitalizedDiseaseClass,
        cropName: capitalizedCropName,
        diseaseInfo: finalDiseaseInfo,
        imageUrl: imageResult.secureUrl,
      };
    } catch (error) {
      this.logger.error('detectCropDisease error:', error);
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
      this.logger.log(`Making Roboflow API call to: ${endpoint}`);
      this.logger.log(`Image URL: ${image}`);

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

      this.logger.log('Roboflow API call successful');
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

  // Method to fetch disease information from external APIs
  async fetchDiseaseInfo(diseaseClass: string) {
    try {
      // Try Wikipedia API first (free, no limits)
      const wikiInfo = await this.fetchWikipediaInfo(diseaseClass);
      if (wikiInfo) {
        return wikiInfo;
      }

      // Try Plant.id Chatbot (requires API key, but more interactive)
      const chatbotInfo = await this.getDiseaseInfoFromChatbot(diseaseClass);
      if (chatbotInfo) {
        return chatbotInfo;
      }

      // Try AI-powered disease information (OpenRouter)
      const aiInfo = await this.helper.getDiseaseInfoFromAI(diseaseClass);
      if (aiInfo) {
        return aiInfo;
      }

      // Fallback to Plant.id API (requires API key)
      const plantIdInfo = await this.fetchPlantIdInfo(diseaseClass);
      if (plantIdInfo) {
        return plantIdInfo;
      }

      // Default fallback information
      return this.getDefaultDiseaseInfo(diseaseClass);
    } catch (error) {
      this.logger.error('Error fetching disease info:', error);
      return this.getDefaultDiseaseInfo(diseaseClass);
    }
  }

  async fetchWikipediaInfo(diseaseClass: string) {
    try {
      const searchTerm = diseaseClass.replace(/_/g, ' ');
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${searchTerm}`;

      const response = await this.httpService.axiosRef.get(url);

      if (response.data && response.data.extract) {
        return {
          description: response.data.extract,
          causes: this.extractCausesFromText(response.data.extract),
          symptoms: this.extractSymptomsFromText(response.data.extract),
          prevention: this.extractPreventionFromText(response.data.extract),
          source: 'Wikipedia',
        };
      }
      return null;
    } catch (error) {
      this.logger.warn('Wikipedia API failed:', error.message);
      return null;
    }
  }

  async fetchPlantIdInfo(diseaseClass: string) {
    try {
      const apiKey = this.configService.get<string>('plantid.apiKey');
      if (!apiKey) {
        return null;
      }

      const url = 'https://api.plant.id/v2/health_assessment';
      const response = await this.httpService.axiosRef.post(
        url,
        {
          images: [diseaseClass], // You might need to adjust this
          modifiers: ['health_all'],
          plant_details: ['common_names', 'url', 'wiki_description'],
        },
        {
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data && response.data.health_assessment) {
        return {
          description: response.data.health_assessment.description,
          causes: response.data.health_assessment.causes || [],
          symptoms: response.data.health_assessment.symptoms || [],
          prevention: response.data.health_assessment.treatment || [],
          source: 'Plant.id',
        };
      }
      return null;
    } catch (error) {
      this.logger.warn('Plant.id API failed:', error.message);
      return null;
    }
  }

  getDefaultDiseaseInfo(diseaseClass: string) {
    // Default information based on disease class
    const diseaseInfo = {
      potato_early_blight: {
        description:
          'Early blight is a common fungal disease of potatoes caused by Alternaria solani.',
        causes: [
          'Fungal infection',
          'Wet weather conditions',
          'Poor air circulation',
        ],
        symptoms: [
          'Dark brown spots on leaves',
          'Yellowing of leaves',
          'Defoliation',
        ],
        prevention: [
          'Crop rotation',
          'Proper spacing',
          'Fungicide application',
        ],
        source: 'Default Database',
      },
      potato_late_blight: {
        description:
          'Late blight is a devastating disease caused by Phytophthora infestans.',
        causes: ['Fungal infection', 'Cool, wet weather', 'High humidity'],
        symptoms: [
          'Water-soaked lesions',
          'White fungal growth',
          'Rapid plant death',
        ],
        prevention: [
          'Resistant varieties',
          'Fungicide sprays',
          'Good drainage',
        ],
        source: 'Default Database',
      },
    };

    return (
      diseaseInfo[diseaseClass] || {
        description: `Information about ${diseaseClass} is not available.`,
        causes: ['Unknown'],
        symptoms: ['Unknown'],
        prevention: ['Consult local agricultural extension'],
        source: 'Default Database',
      }
    );
  }

  extractCausesFromText(text: string): string[] {
    // Simple keyword extraction for causes
    const causes: string[] = [];
    if (text.toLowerCase().includes('fungal')) causes.push('Fungal infection');
    if (text.toLowerCase().includes('bacterial'))
      causes.push('Bacterial infection');
    if (text.toLowerCase().includes('viral')) causes.push('Viral infection');
    if (text.toLowerCase().includes('weather'))
      causes.push('Weather conditions');
    if (text.toLowerCase().includes('moisture')) causes.push('Excess moisture');
    return causes.length > 0 ? causes : ['Environmental factors'];
  }

  extractSymptomsFromText(text: string): string[] {
    // Simple keyword extraction for symptoms
    const symptoms: string[] = [];
    if (text.toLowerCase().includes('spots'))
      symptoms.push('Dark spots on leaves');
    if (text.toLowerCase().includes('yellow'))
      symptoms.push('Yellowing of leaves');
    if (text.toLowerCase().includes('wilting')) symptoms.push('Plant wilting');
    if (text.toLowerCase().includes('lesions'))
      symptoms.push('Lesions on plant tissue');
    return symptoms.length > 0 ? symptoms : ['Visible damage to plant'];
  }

  extractPreventionFromText(text: string): string[] {
    // Simple keyword extraction for prevention
    const prevention: string[] = [];
    if (text.toLowerCase().includes('rotation'))
      prevention.push('Crop rotation');
    if (text.toLowerCase().includes('fungicide'))
      prevention.push('Fungicide application');
    if (text.toLowerCase().includes('spacing'))
      prevention.push('Proper plant spacing');
    if (text.toLowerCase().includes('drainage'))
      prevention.push('Good drainage');
    return prevention.length > 0 ? prevention : ['Good agricultural practices'];
  }

  // Plant.id Chatbot API methods
  async startPlantIdConversation(accessToken: string) {
    try {
      const apiKey = this.configService.get<string>('plantid.apiKey');
      if (!apiKey) {
        throw new Error('Plant.id API key not configured');
      }

      const url = `https://api.plant.id/api/v3/identification/${accessToken}/conversation`;
      const response = await this.httpService.axiosRef.post(
        url,
        {
          // Initial conversation setup
          message:
            'Hello, I need help with plant disease identification and treatment advice.',
        },
        {
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error('Plant.id chatbot conversation failed:', error.message);
      throw error;
    }
  }

  async sendMessageToPlantIdChatbot(
    accessToken: string,
    message: string,
    conversationId?: string,
  ) {
    try {
      const apiKey = this.configService.get<string>('plantid.apiKey');
      if (!apiKey) {
        throw new Error('Plant.id API key not configured');
      }

      const url = `https://api.plant.id/api/v3/identification/${accessToken}/conversation`;
      const payload: any = {
        message: message,
      };

      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const response = await this.httpService.axiosRef.post(url, payload, {
        headers: {
          'Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error('Plant.id chatbot message failed:', error.message);
      throw error;
    }
  }

  async getDiseaseInfoFromChatbot(diseaseClass: string) {
    try {
      const apiKey = this.configService.get<string>('plantid.apiKey');
      if (!apiKey) {
        return null;
      }

      // Create a conversation about the specific disease
      const conversation = await this.startPlantIdConversation(apiKey);

      // Ask specific questions about the disease
      const questions = [
        `What is ${diseaseClass.replace(/_/g, ' ')}?`,
        `What are the symptoms of ${diseaseClass.replace(/_/g, ' ')}?`,
        `How can I prevent ${diseaseClass.replace(/_/g, ' ')}?`,
        `What treatments are available for ${diseaseClass.replace(/_/g, ' ')}?`,
      ];

      let conversationId = conversation.conversation_id;
      const allResponses: any[] = [];

      for (const question of questions) {
        const response = await this.sendMessageToPlantIdChatbot(
          apiKey,
          question,
          conversationId,
        );
        allResponses.push(response);
        conversationId = response.conversation_id;
      }

      // Extract information from responses
      const diseaseInfo =
        this.extractDiseaseInfoFromChatbotResponses(allResponses);

      return {
        description: diseaseInfo.description,
        causes: diseaseInfo.causes,
        symptoms: diseaseInfo.symptoms,
        prevention: diseaseInfo.prevention,
        source: 'Plant.id Chatbot',
      };
    } catch (error) {
      this.logger.warn('Plant.id chatbot failed:', error.message);
      return null;
    }
  }

  extractDiseaseInfoFromChatbotResponses(responses: any[]) {
    // Extract relevant information from chatbot responses
    let description = '';
    let causes: string[] = [];
    let symptoms: string[] = [];
    let prevention: string[] = [];

    responses.forEach((response) => {
      const message = response.message?.toLowerCase() || '';

      if (message.includes('symptom')) {
        symptoms = this.extractSymptomsFromText(response.message);
      } else if (message.includes('prevent') || message.includes('treatment')) {
        prevention = this.extractPreventionFromText(response.message);
      } else if (message.includes('cause')) {
        causes = this.extractCausesFromText(response.message);
      } else {
        description = response.message || '';
      }
    });

    return {
      description: description || 'Information from Plant.id chatbot',
      causes:
        causes.length > 0 ? causes : ['Consult chatbot for specific causes'],
      symptoms:
        symptoms.length > 0
          ? symptoms
          : ['Consult chatbot for specific symptoms'],
      prevention:
        prevention.length > 0
          ? prevention
          : ['Consult chatbot for specific prevention methods'],
    };
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
      const crops = await this.prisma.user.findMany({
        where: {
          email,
        },
        select: {
          crops: {
            select: {
              id: true,
              name: true,
              infections: {
                include: {
                  diseaseImages: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        data: crops,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw new ForbiddenException('Access forbidden for this service');
      }
      throw new Error();
    }
  }

  async deleteFarmerCrop(cropId: string, email: string) {
    try {
      this.logger.log(
        `Attempting to delete crop with ID: ${cropId} for user: ${email}`,
      );

      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        this.logger.warn(`User not found for email: ${email}`);
        throw new ForbiddenException('Access forbidden for this request');
      }

      this.logger.log(`User found with ID: ${user.id}`);

      // Find the crop and ensure the user is the owner
      const crop = await this.prisma.crop.findUnique({ where: { id: cropId } });
      this.logger.log(`Crop lookup result:`, crop);

      if (!crop) {
        this.logger.warn(`Crop not found with ID: ${cropId}`);
        throw new BadRequestException('Crop not found');
      }

      this.logger.log(
        `Crop found - User ID: ${crop.userId}, Requesting User ID: ${user.id}`,
      );

      if (crop.userId !== user.id) {
        this.logger.warn(
          `User ${user.id} not authorized to delete crop ${cropId} owned by ${crop.userId}`,
        );
        throw new ForbiddenException('You are not allowed to delete this crop');
      }

      await this.prisma.crop.delete({ where: { id: cropId } });
      this.logger.log(`Crop ${cropId} deleted successfully`);
      return { message: 'Crop deleted successfully' };
    } catch (error) {
      this.logger.error(`Error in deleteFarmerCrop:`, error);
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

  // Debug method to check crop details
  async debugCrop(cropId: string, email: string) {
    try {
      this.logger.log(
        `Debug: Checking crop with ID: ${cropId} for user: ${email}`,
      );

      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          userEmail: email,
        };
      }

      // Check if crop exists
      const crop = await this.prisma.crop.findUnique({
        where: { id: cropId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          infections: {
            select: {
              id: true,
              diseaseClass: true,
              diseaseDescription: true,
            },
          },
        },
      });

      if (!crop) {
        return {
          success: false,
          error: 'Crop not found',
          cropId,
          userEmail: email,
          userId: user.id,
        };
      }

      return {
        success: true,
        crop,
        requestingUser: {
          id: user.id,
          email: user.email,
        },
        ownershipMatch: crop.userId === user.id,
      };
    } catch (error) {
      this.logger.error('Debug crop error:', error);
      return {
        success: false,
        error: error.message,
        cropId,
        userEmail: email,
      };
    }
  }
}
