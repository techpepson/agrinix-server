import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import ShortUniqueId from 'short-unique-id';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { ConfigService } from '@nestjs/config';
import cloudinary from 'src/config/cloudinary.config';
import OpenAI from 'openai';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class HelpersService {
  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}
  logger = new Logger(HelpersService.name);

  generateUniqueId() {
    const uid = new ShortUniqueId({ length: 5, dictionary: 'alphanum' });
    return {
      id: uid.rnd(),
    };
  }

  async nodemailerSetup(
    receiver: string,
    subject: string,
    html: any,
    textBody?: string,
  ) {
    try {
      const emailUser = this.configService.get<string>('email.user');
      const emailPass = this.configService.get<string>('email.password');

      this.logger.debug({ user: emailUser, password: emailPass });

      // Debug logging
      this.logger.debug('Email config:', {
        user: emailUser ? 'Set' : 'Not set',
        pass: emailPass ? 'Set' : 'Not set',
      });

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      const info = await transporter.sendMail({
        from: 'Agrinix',
        to: receiver,
        subject: subject,
        html,
        text: textBody,
      });

      console.log(`Message sent with id ${info.messageId}`);
    } catch (error) {
      if (error.code === 'EAUTH') {
        throw new UnauthorizedException('Email authentication failed');
      }
      if (error.code === 'ESOCKET') {
        throw new ServiceUnavailableException('Email service unavailable');
      }
      this.logger.error('Failed to send email:', error);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async renderEjs(templatePath: string, data: any) {
    try {
      const filePath = path.join(process.cwd(), 'src', 'views', templatePath);

      //check if the path exists
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException(
          `Template path ${templatePath} does not exist`,
        );
      }

      const renderedFile = await ejs.renderFile(filePath, data);

      return renderedFile;
    } catch (error) {
      this.logger?.error?.('Failed to render EJS template:', error);
      throw new InternalServerErrorException('Failed to render EJS template');
    }
  }

  async sendEjsAsEmail(
    emailSubject: string,
    data: any,
    templatePath: any,
    emailReceiver: any,
  ) {
    const html = await this.renderEjs(templatePath, data);

    //send the email to the user
    await this.nodemailerSetup(emailReceiver, emailSubject, html);
  }

  async uploadImage(file: Express.Multer.File) {
    try {
      //check if the file has a buffer
      if (!file.buffer) {
        throw new NotFoundException('File buffer empty');
      }

      //convert the file buffer to a base64 string
      const base64String = Buffer.from(file.buffer).toString('base64');
      const mimeType = file.mimetype;

      const dataUri = `data:${mimeType};base64,${base64String}`;

      const uploader = await cloudinary.uploader.upload(dataUri, {
        overwrite: true,
        use_filename: true,
      });
      return {
        secureUrl: uploader.secure_url,
        public_id: uploader.public_id,
        url: uploader.url,
        createdAt: uploader.created_at,
      };
    } catch (error) {
      console.error(error);
      if (error instanceof NotFoundException) {
        throw new NotFoundException('File buffer not found');
      } else if (error instanceof BadRequestException) {
        throw new BadRequestException('Bad request received');
      } else {
        throw new InternalServerErrorException(
          `An internal server error occurred while uploading image:${error.message} `,
        );
      }
    }
  }

  async makeOpenRouterCall(prompt: string, systemPrompt?: string) {
    try {
      const openRouterKey = this.configService.get<string>('openRouter.key');

      if (!openRouterKey) {
        throw new Error('OpenRouter API key is not configured');
      }

      // Try direct HTTP call first (more reliable)
      try {
        return await this.makeDirectOpenRouterCall(
          prompt,
          openRouterKey,
          systemPrompt,
        );
      } catch (directError) {
        this.logger.warn(
          'Direct OpenRouter call failed, trying OpenAI SDK:',
          directError.message,
        );

        // Fallback to OpenAI SDK
        const openai = new OpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: openRouterKey,
          defaultHeaders: {
            'HTTP-Referer':
              this.configService.get<string>('appEnv.baseUrl') ||
              'http://localhost:3000',
            'X-Title': 'Agrinix',
          },
        });

        const messages: any[] = [];

        if (systemPrompt) {
          messages.push({
            role: 'system',
            content: systemPrompt,
          });
        }

        messages.push({
          role: 'user',
          content: prompt,
        });

        const completion = await openai.chat.completions.create({
          model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
          messages,
          max_tokens: 2000,
          temperature: 0.7,
        });

        const response = completion.choices[0]?.message?.content;

        if (!response) {
          throw new Error('No response received from OpenRouter');
        }

        return {
          success: true,
          response,
          usage: completion.usage,
        };
      }
    } catch (error) {
      this.logger.error('OpenRouter API call failed:', error.message);
      throw new InternalServerErrorException(
        `Failed to get AI response: ${error.message}`,
      );
    }
  }

  private async makeDirectOpenRouterCall(
    prompt: string,
    apiKey: string,
    systemPrompt?: string,
  ) {
    const messages: any[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const requestBody = {
      model: 'deepseek/deepseek-r1-0528-qwen3-8b:free',
      messages,
      max_tokens: 2000,
      temperature: 0.7,
    };

    console.log('Making direct OpenRouter call with:', requestBody);

    const response = await this.httpService.axiosRef.post(
      'https://openrouter.ai/api/v1/chat/completions',
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            this.configService.get<string>('appEnv.baseUrl') ||
            'http://localhost:3000',
          'X-Title': 'Agrinix',
        },
      },
    );

    console.log('Direct OpenRouter response:', response.data);

    const aiResponse = response.data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response received from OpenRouter');
    }

    return {
      success: true,
      response: aiResponse,
      usage: response.data.usage,
    };
  }

  async getDiseaseInfoFromAI(diseaseClass: string) {
    const systemPrompt = `You are an expert agricultural scientist with 20+ years of experience in plant pathology. You specialize in crop diseases and provide detailed, accurate information. 

IMPORTANT: You must respond ONLY with valid JSON in this exact format:
{
  "description": "Detailed description of the disease including scientific name, type of pathogen, and affected crops",
  "causes": ["Cause 1", "Cause 2", "Cause 3"],
  "symptoms": ["Symptom 1", "Symptom 2", "Symptom 3"],
  "prevention": ["Prevention method 1", "Prevention method 2", "Prevention method 3"],
  "treatment": ["Treatment option 1", "Treatment option 2", "Treatment option 3"]
}

CRITICAL REQUIREMENTS:
1. Provide SPECIFIC, DETAILED information for each disease
2. Include scientific names of pathogens when known
3. List specific environmental conditions that cause the disease
4. Describe clear visual symptoms that farmers can identify
5. Give practical, actionable prevention and treatment methods
6. Do not use generic responses - each disease should have unique, detailed information
7. Do not include any text before or after the JSON. Only return the JSON object.`;

    const userPrompt = `Provide comprehensive information about ${diseaseClass.replace(/_/g, ' ')} disease. 

REQUIRED INFORMATION:
- Scientific name of the pathogen (e.g., "Fusarium oxysporum", "Xanthomonas campestris")
- Detailed description of the disease and how it affects plants
- Specific environmental conditions that trigger the disease (temperature, humidity, soil conditions)
- Clear visual symptoms that farmers can identify in the field
- Practical prevention methods that farmers can implement
- Effective treatment options including chemical and non-chemical approaches

IMPORTANT: Provide SPECIFIC details for this particular disease. Do not give generic agricultural advice. Include scientific names, specific symptoms, and actionable recommendations.`;

    try {
      const result = await this.makeOpenRouterCall(userPrompt, systemPrompt);

      // Try to parse JSON response
      try {
        const parsedResponse = JSON.parse(result.response);
        return {
          description:
            parsedResponse.description || 'Information not available',
          causes: Array.isArray(parsedResponse.causes)
            ? parsedResponse.causes
            : ['Unknown'],
          symptoms: Array.isArray(parsedResponse.symptoms)
            ? parsedResponse.symptoms
            : ['Unknown'],
          prevention: Array.isArray(parsedResponse.prevention)
            ? parsedResponse.prevention
            : ['Unknown'],
          treatment: Array.isArray(parsedResponse.treatment)
            ? parsedResponse.treatment
            : ['Unknown'],
          source: 'AI Assistant',
        };
      } catch (parseError) {
        this.logger.warn(
          'JSON parsing failed, trying to extract from text:',
          parseError.message,
        );
        this.logger.debug('Raw AI response:', result.response);

        // If JSON parsing fails, extract information from text
        return this.extractDiseaseInfoFromText(result.response, diseaseClass);
      }
    } catch (error) {
      this.logger.error('AI disease info failed:', error.message);
      return null;
    }
  }

  private extractDiseaseInfoFromText(text: string, diseaseClass: string) {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let description = '';
    const causes: string[] = [];
    const symptoms: string[] = [];
    const prevention: string[] = [];
    const treatment: string[] = [];

    let currentSection = '';

    for (const line of lines) {
      const lowerLine = line.toLowerCase();

      if (
        lowerLine.includes('description') ||
        lowerLine.includes('overview') ||
        lowerLine.includes('about')
      ) {
        currentSection = 'description';
      } else if (
        lowerLine.includes('cause') ||
        lowerLine.includes('reason') ||
        lowerLine.includes('trigger')
      ) {
        currentSection = 'causes';
      } else if (
        lowerLine.includes('symptom') ||
        lowerLine.includes('sign') ||
        lowerLine.includes('appearance')
      ) {
        currentSection = 'symptoms';
      } else if (
        lowerLine.includes('prevent') ||
        lowerLine.includes('avoid') ||
        lowerLine.includes('control')
      ) {
        currentSection = 'prevention';
      } else if (
        lowerLine.includes('treat') ||
        lowerLine.includes('cure') ||
        lowerLine.includes('manage') ||
        lowerLine.includes('solution')
      ) {
        currentSection = 'treatment';
      } else if (
        line.startsWith('-') ||
        line.startsWith('•') ||
        line.startsWith('*') ||
        line.match(/^\d+\./)
      ) {
        // This is a list item
        const item = line
          .replace(/^[-•*]\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .trim();

        if (item.length > 5) {
          // Only add meaningful items
          switch (currentSection) {
            case 'causes':
              causes.push(item);
              break;
            case 'symptoms':
              symptoms.push(item);
              break;
            case 'prevention':
              prevention.push(item);
              break;
            case 'treatment':
              treatment.push(item);
              break;
          }
        }
      } else if (
        currentSection === 'description' &&
        line.length > 20 &&
        !line.includes(':')
      ) {
        // For description, take longer sentences that don't contain colons
        description = line;
      } else if (line.includes(':') && line.length > 10) {
        // Handle lines with colons (like "Causes: fungal infection")
        const [key, value] = line.split(':').map((part) => part.trim());
        const lowerKey = key.toLowerCase();

        if (lowerKey.includes('cause') && value.length > 5) {
          causes.push(value);
        } else if (lowerKey.includes('symptom') && value.length > 5) {
          symptoms.push(value);
        } else if (lowerKey.includes('prevent') && value.length > 5) {
          prevention.push(value);
        } else if (lowerKey.includes('treat') && value.length > 5) {
          treatment.push(value);
        } else if (lowerKey.includes('description') && value.length > 10) {
          description = value;
        }
      }
    }

    // If we still don't have enough information, try to extract from the full text
    if (causes.length === 0 && text.toLowerCase().includes('fungal')) {
      causes.push('Fungal infection');
    }
    if (causes.length === 0 && text.toLowerCase().includes('bacterial')) {
      causes.push('Bacterial infection');
    }
    if (causes.length === 0 && text.toLowerCase().includes('viral')) {
      causes.push('Viral infection');
    }
    if (causes.length === 0 && text.toLowerCase().includes('weather')) {
      causes.push('Weather conditions');
    }
    if (causes.length === 0 && text.toLowerCase().includes('moisture')) {
      causes.push('Excess moisture');
    }

    if (symptoms.length === 0 && text.toLowerCase().includes('spot')) {
      symptoms.push('Dark spots on leaves');
    }
    if (symptoms.length === 0 && text.toLowerCase().includes('yellow')) {
      symptoms.push('Yellowing of leaves');
    }
    if (symptoms.length === 0 && text.toLowerCase().includes('wilt')) {
      symptoms.push('Plant wilting');
    }
    if (symptoms.length === 0 && text.toLowerCase().includes('lesion')) {
      symptoms.push('Lesions on plant tissue');
    }

    if (prevention.length === 0 && text.toLowerCase().includes('rotation')) {
      prevention.push('Crop rotation');
    }
    if (prevention.length === 0 && text.toLowerCase().includes('fungicide')) {
      prevention.push('Fungicide application');
    }
    if (prevention.length === 0 && text.toLowerCase().includes('spacing')) {
      prevention.push('Proper plant spacing');
    }
    if (prevention.length === 0 && text.toLowerCase().includes('drainage')) {
      prevention.push('Good drainage');
    }

    return {
      description:
        description ||
        `Detailed information about ${diseaseClass.replace(/_/g, ' ')} disease`,
      causes:
        causes.length > 0
          ? causes
          : ['Environmental factors', 'Pathogen infection'],
      symptoms:
        symptoms.length > 0
          ? symptoms
          : ['Visible damage to plant tissue', 'Abnormal growth patterns'],
      prevention:
        prevention.length > 0
          ? prevention
          : ['Good agricultural practices', 'Regular monitoring'],
      treatment:
        treatment.length > 0
          ? treatment
          : ['Remove infected plants', 'Apply appropriate treatments'],
      source: 'AI Assistant (Text Extraction)',
    };
  }
}
