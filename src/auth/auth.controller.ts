import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('tiktok')
  async tiktokCallback(@Query('code') code: string, @Res() res: Response) {
    const { customToken } = await this.authService.handleTikTokSignIn(code);
    const scheme = process.env.PUBLIC_APP_SCHEME || 'reviz';
    return res.redirect(`${scheme}://tikTok_auth/${encodeURIComponent(customToken)}`);
  }

  @Get('connect/tiktok')
  async tiktokConnect(@Query('code') code: string, @Query('state') stateIdToken: string, @Res() res: Response) {
    await this.authService.handleTikTokConnect(code, stateIdToken);
    const scheme = process.env.PUBLIC_APP_SCHEME || 'reviz';
    return res.redirect(`${scheme}://tiktok_connected`);
  }
  
  @Get('hello')
  hello() {
    return 'i see you';
  }
}
