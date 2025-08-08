import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface ExchangeCodeParams {
  code: string;
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
}

export interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
  open_id?: string;
}

@Injectable()
export class TikTokService {
  private readonly tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
  private readonly userInfoUrl = 'https://open.tiktokapis.com/v2/user/info/';

  async exchangeCodeForTokens(params: ExchangeCodeParams): Promise<TikTokTokenResponse> {
    const { code, clientKey, clientSecret, redirectUri } = params;

    const body = new URLSearchParams();
    body.set('client_key', clientKey);
    body.set('client_secret', clientSecret);
    body.set('code', code);
    body.set('grant_type', 'authorization_code');
    body.set('redirect_uri', redirectUri);

    try {
      const { data } = await axios.post(this.tokenUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
        validateStatus: () => true,
      });

      if (!data?.access_token) {
        const errMsg = typeof data === 'object' ? JSON.stringify(data) : String(data);
        throw new Error(`TikTok token exchange failed: ${errMsg}`);
      }
      return data as TikTokTokenResponse;
    } catch (e: any) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : e?.message || 'unknown_error';
      throw new Error(`TikTok token exchange failed: ${msg}`);
    }
  }

  async refreshAccessToken(refreshToken: string, clientKey: string, clientSecret: string): Promise<TikTokTokenResponse> {
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refreshToken);
    body.set('client_key', clientKey);
    body.set('client_secret', clientSecret);

    const { data } = await axios.post(this.tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    if (!data?.access_token) {
      throw new Error('TikTok token refresh failed');
    }
    return data as TikTokTokenResponse;
  }

  async fetchUserInfo(accessToken: string): Promise<any> {
    const fields = [
      'open_id',
      'display_name',
      'avatar_url',
      'follower_count',
      'following_count',
      'likes_count',
      'video_count',
    ];

    const url = `${this.userInfoUrl}?fields=${encodeURIComponent(fields.join(','))}`;
    const { data } = await axios.get(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });

    if (!data) {
      throw new Error('TikTok user fetch failed');
    }

    // Normalize to a predictable shape
    const user = data.data?.user || data.data || data.user || data;
    return {
      open_id: user.open_id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      stats: {
        follower_count: user.follower_count,
        following_count: user.following_count,
        likes_count: user.likes_count,
        video_count: user.video_count,
      },
      raw: data,
    };
  }
}
