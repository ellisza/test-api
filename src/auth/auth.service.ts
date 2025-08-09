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

  async handleTikTokSignIn(
    code: string,
    computedRedirectUri?: string,
  ): Promise<{
    customToken: string;
    profile: { open_id: string; display_name?: string; avatar_url?: string };
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
      redirectUri: computedRedirectUri ?? AUTH_REDIRECT_URI,
    });

    const profile = await this.tikTokService.fetchUserInfo(tokenResponse.access_token);

    // Upsert user by TikTok open_id
    const user = await this.usersService.upsertByTikTok(profile, tokenResponse);

    // Issue Firebase custom token for unified UID (do not update Auth profile yet; user may not exist until client signs in)
    const firebaseCustomToken = await this.firebaseService.createCustomToken(user.uid, {
      provider: 'tiktok',
    });

    return {
      customToken: firebaseCustomToken,
      profile: {
        open_id: profile.open_id,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
    };
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

  /**
   * Verifies a Firebase ID token from the mobile app and returns a backend session token plus user info
   * in the wrapped format { data: { token, user } } that the Expo app expects.
   */
  async handleFirebaseIdTokenAuth(idToken: string): Promise<{
    data: {
      token: string;
      user: { id: string; username: string; email: string; role: string; name: string; photoURL?: string };
    };
  }> {
    const decoded = await this.firebaseService.verifyIdToken(idToken);
    const uid = decoded.uid;

    let user = this.usersService.getUserByUid(uid);
    // If user was deleted in Firebase and re-signed in, ensure our in-memory record exists
    if (!user) {
      user = { uid, providers: {} } as any;
    }
    // Best-effort profile sync after client is signed in (user exists in Firebase now)
    await this.firebaseService.updateUserProfile(uid, {
      displayName: (user && user.displayName) || decoded.name,
      photoURL: (user && user.avatarUrl) || (decoded as any).picture,
    });
    const displayName = user?.displayName || decoded.name || 'User';
    const photoURL = user?.avatarUrl || (decoded as any).picture || undefined;

    // For quick-launch, mint a placeholder backend token
    const backendToken = `dev-${uid}-${Math.random().toString(36).slice(2)}`;

    return {
      data: {
        token: backendToken,
        user: {
          id: uid,
          username: displayName,
          email: decoded.email || '',
          role: 'user',
          name: displayName,
          photoURL,
        },
      },
    };
  }
}
