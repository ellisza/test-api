import { Injectable } from '@nestjs/common';
import { TikTokService } from '../tiktok/tiktok.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { UsersService, TikTokProfile, TikTokTokens } from '../users/users.service.js';

const AUTH_REDIRECT_URI = 'https://registry.stg.reviz.dev/api/auth/tiktok';
const CONNECT_REDIRECT_URI = 'https://registry.stg.reviz.dev/api/auth/connect/tiktok';

@Injectable()
export class AuthService {
  constructor(
    private readonly tikTokService: TikTokService,
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  async handleTikTokSignIn(code: string): Promise<{ customToken: string }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY as string;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET as string;
    if (!clientKey || !clientSecret) {
      throw new Error('Missing TikTok client config');
    }

    const tokenResponse = await this.tikTokService.exchangeCodeForTokens({
      code,
      clientKey,
      clientSecret,
      redirectUri: AUTH_REDIRECT_URI,
    });

    const profile = await this.tikTokService.fetchUserInfo(tokenResponse.access_token);

    // Upsert user by TikTok open_id
    const user = await this.usersService.upsertByTikTok(profile, tokenResponse);

    // Issue Firebase custom token for unified UID
    const firebaseCustomToken = await this.firebaseService.createCustomToken(user.uid, {
      provider: 'tiktok',
    });

    return { customToken: firebaseCustomToken };
  }

  async handleTikTokConnect(code: string, stateFirebaseIdToken: string): Promise<void> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY as string;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET as string;
    if (!clientKey || !clientSecret) {
      throw new Error('Missing TikTok client config');
    }

    // Verify Firebase ID token from state to identify the user performing the connect
    const decoded = await this.firebaseService.verifyIdToken(stateFirebaseIdToken);
    const uid = decoded.uid;

    const tokenResponse: TikTokTokens = await this.tikTokService.exchangeCodeForTokens({
      code,
      clientKey,
      clientSecret,
      redirectUri: CONNECT_REDIRECT_URI,
    });

    const profile: TikTokProfile = await this.tikTokService.fetchUserInfo(tokenResponse.access_token);

    await this.usersService.linkTikTokToUser(uid, profile, tokenResponse);

    return;
  }
}
