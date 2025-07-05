/*
https://docs.nestjs.com/providers#services
*/

import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Job } from 'bullmq';
import { HelpersService } from 'src/helpers/helpers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Processor('process-image')
@Injectable()
export class ImageUploadProcessor extends WorkerHost {
  logger = new Logger(ImageUploadProcessor.name);
  constructor(
    private readonly helpers: HelpersService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { email, file } = job.data;
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

      const imageResult = await this.helpers.uploadImage(file);

      // Now use imageResult.secureUrl, etc.
      const prediction = await this.fetchRoboflowPrediction(
        imageResult.secureUrl,
      );

      // Log the complete Roboflow response for debugging

      // Validate Roboflow response structure
      const outputs = prediction?.response?.outputs;

      if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
        return {
          message:
            'Oops! Our model could not predict this. Please try again with a clearer image',
        };
      }
      // Get the first output's model_prediction_output
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

      // Extract crop name from disease class (e.g., "potato_early_blight" -> "Potato")
      const diseaseClass: string = modelPrediction.predictions[0].class;

      const splitDiseaseClass = diseaseClass.split('_');

      // Capitalize only the first word and join all elements back together
      const capitalizedDiseaseClass =
        splitDiseaseClass[0].charAt(0).toUpperCase() +
        splitDiseaseClass[0].slice(1) +
        ' ' +
        splitDiseaseClass.slice(1).join('_');

      const cropName = diseaseClass.split('_')[0]; // Extract first part before underscore

      const healthyCropName = diseaseClass.split('_')[1]; // Extract first part before underscore

      // Capitalize first letter of crop name
      const capitalizedCropName =
        cropName.charAt(0).toUpperCase() + cropName.slice(1);

      const capitalizedCropNameWhenHealthy =
        healthyCropName.charAt(0).toUpperCase() + healthyCropName.slice(1);

      //get the second actual crop name if the class starts with 'healthy'
      const isHealthy = splitDiseaseClass[0] == 'healthy' ? true : false;

      const filteredCropName = isHealthy
        ? capitalizedCropNameWhenHealthy
        : capitalizedCropName || 'Unknown'; // Use capitalized crop name or default
      const diseaseTop = modelPrediction.top;
      const predictionConfidence =
        parseFloat(modelPrediction.confidence) || 1.0; // Convert to float
      const inferenceId = modelPrediction.inference_id; // Use inference_id from modelPrediction
      const imageWidth = parseInt(modelPrediction.image.width) || 0; // Convert to integer
      const imageHeight = parseInt(modelPrediction.image.height) || 0; // Convert to integer

      // Log the extracted values for debugging
      this.logger.log(
        `Extracted values - Confidence: ${modelPrediction.confidence} -> ${predictionConfidence}`,
      );
      this.logger.log(
        `Image dimensions - Width: ${modelPrediction.image.width} -> ${imageWidth}, Height: ${modelPrediction.image.height} -> ${imageHeight}`,
      );

      // Fetch disease information from external APIs
      const diseaseInfo = await this.helpers.getDiseaseInfoFromAI(diseaseClass);

      // Provide fallback disease info if AI call fails
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

      // Use AI disease info if available, otherwise use fallback
      const finalDiseaseInfo = diseaseInfo || fallbackDiseaseInfo;

      //save the prediction to the database against the farmer name
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
        diseaseInfo: finalDiseaseInfo,
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
      const aiInfo = await this.helpers.getDiseaseInfoFromAI(diseaseClass);
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
}
