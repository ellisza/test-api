import { Injectable } from '@nestjs/common';
import { TikTokService } from '../tiktok/tiktok.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { UsersService, TikTokProfile, TikTokTokens } from '../users/users.service.js';

const AUTH_REDIRECT_URI = process.env.AUTH_REDIRECT_URI || 'https://registry.stg.reviz.dev/api/auth/tiktok';
const CONNECT_REDIRECT_URI = process.env.CONNECT_REDIRECT_URI || 'https://registry.stg.reviz.dev/api/auth/connect/tiktok';

@Injectable()
export class AuthService {
  constructor(
    private readonly tikTokService: TikTokService,
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  async handleTikTokSignIn(code: string, computedRedirectUri?: string): Promise<{ customToken: string }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY as string;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET as string;
    if (!clientKey || !clientSecret) {
      throw new Error('Missing TikTok client config');
    }

    const tokenResponse = await this.tikTokService.exchangeCodeForTokens({
      code,
      clientKey,
      clientSecret,
      redirectUri: computedRedirectUri ?? AUTH_REDIRECT_URI,
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

  async handleTikTokConnect(code: string, stateFirebaseIdToken: string, computedRedirectUri?: string): Promise<void> {
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
      redirectUri: computedRedirectUri ?? CONNECT_REDIRECT_URI,
    });

    const profile: TikTokProfile = await this.tikTokService.fetchUserInfo(tokenResponse.access_token);

    await this.usersService.linkTikTokToUser(uid, profile, tokenResponse);

    return;
  }

  /**
   * Exchanges code for TikTok tokens and returns Firebase custom token (embedding refresh token)
   * along with selected TikTok profile fields for frontend consumption.
   */
  async handleFirebaseCodeExchange(code: string, redirectUri: string): Promise<{
    firebaseCustomToken: string;
    profile: { display_name?: string; avatar_url?: string; open_id: string };
  }> {
    const clientKey = process.env.TIKTOK_CLIENT_KEY as string;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET as string;
    if (!clientKey || !clientSecret) {
      throw new Error('Missing TikTok client config');
    }

    const tokenResponse = await this.tikTokService.exchangeCodeForTokens({
      code,
      clientKey,
      clientSecret,
      redirectUri,
    });

    const profile = await this.tikTokService.fetchUserInfo(tokenResponse.access_token);

    // Save/Upsert in our in-memory store as well
    const user = await this.usersService.upsertByTikTok(profile, tokenResponse);

    // Embed refresh token in custom claims so the mobile app can store/rotate it server-side later if needed
    const firebaseCustomToken = await this.firebaseService.createCustomToken(user.uid, {
      tiktok_refresh_token: tokenResponse.refresh_token,
    });

    return {
      firebaseCustomToken,
      profile: {
        open_id: profile.open_id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
    };
  }
}
