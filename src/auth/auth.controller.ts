import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from 'src/dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() payload: RegisterDto) {
    const register = await this.authService.emailRegister(payload);
    return {
      message: register.message,
    };
  }

  @Post('login')
  async login(@Body() payload: LoginDto) {
    const loginService = await this.authService.emailLogin(payload);

    return {
      message: loginService.message,
      token: loginService.token,
      freqStatus: loginService.hasLoggedInBefore,
      userId: loginService.userId,
    };
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('email') email: string,
    @Query('verificationId') verificationId: string,
  ) {
    return await this.authService.verifyEmail(email, verificationId);
  }

  @Get('generate-email-token')
  async generateEmailToken(@Query('email') email: string) {
    //generate a new token for the user
    return await this.authService.generateEmailToken(email);
  }
}
