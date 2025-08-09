import { Body, Controller, Get, Post, Query, Res, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import axios from 'axios';

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
    // Provide a proxy URL for avatars to avoid 403 due to TikTok CDN hotlink protection
    const avatarProxy = profile.avatar_url ? `${base}/api/auth/tiktok/avatar?src=${encodeURIComponent(profile.avatar_url)}` : '';
    const scheme = process.env.PUBLIC_APP_SCHEME || 'reviz';
    const qp = new URLSearchParams({
      token: customToken,
      open_id: profile.open_id,
      display_name: profile.display_name ?? '',
      avatar_url: profile.avatar_url ?? '',
      avatar_proxy_url: avatarProxy,
    }).toString();
    return res.redirect(`${scheme}://tikTok_auth?${qp}`);
  }
  @Get('tiktok/avatar')
  async proxyAvatar(@Query('src') src: string, @Res() res: Response) {
    if (!src) {
      return res.status(400).send('Missing src');
    }
    try {
      const upstream = await axios.get<ArrayBuffer>(src, {
        responseType: 'arraybuffer',
        timeout: 15000,
        validateStatus: () => true,
      });
      if (upstream.status < 200 || upstream.status >= 300) {
        return res.status(upstream.status).send('Failed to fetch');
      }
      const contentType = upstream.headers['content-type'] || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(Buffer.from(upstream.data));
    } catch (e) {
      return res.status(502).send('Bad gateway');
    }
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
  async firebaseExchange(@Body('idToken') idToken: string) {
    if (!idToken) {
      throw new Error('Missing idToken');
    }
    return this.authService.handleFirebaseIdTokenAuth(idToken);
  }
}
