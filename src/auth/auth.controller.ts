import { Body, Controller, Get, Post, Query, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('tiktok')
  async tiktokCallback(@Query('code') code: string, @Res() res: Response, @Req() req: Request) {
    const schemeHdr = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${schemeHdr}://${host}`;
    const redirectUri = `${base}/api/auth/tiktok`;
    const { customToken, profile } = await this.authService.handleTikTokSignIn(code, redirectUri);
    const scheme = process.env.PUBLIC_APP_SCHEME || 'reviz';
    const qp = new URLSearchParams({
      token: customToken,
      open_id: profile.open_id,
      display_name: profile.display_name ?? '',
      avatar_url: profile.avatar_url ?? '',
    }).toString();
    return res.redirect(`${scheme}://tikTok_auth?${qp}`);
  }

  @Get('hello')
  hello() {
    return { ok: true };
  }

  @Get('connect/tiktok')
  async tiktokConnect(@Query('code') code: string, @Query('state') stateIdToken: string, @Res() res: Response, @Req() req: Request) {
    const schemeHdr = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${schemeHdr}://${host}`;
    const redirectUri = `${base}/api/auth/connect/tiktok`;
    await this.authService.handleTikTokConnect(code, stateIdToken, redirectUri);
    const scheme = process.env.PUBLIC_APP_SCHEME || 'reviz';
    return res.redirect(`${scheme}://tiktok_connected`);
  }

  @Post('firebase')
  async firebaseExchange(@Body('code') code: string, @Req() req: Request) {
    if (!code) {
      throw new Error('Missing code');
    }
    const schemeHdr = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const base = `${schemeHdr}://${host}`;
    const redirectUri = `${base}/api/auth/tiktok`;
    return this.authService.handleFirebaseCodeExchange(code, redirectUri);
  }
}
