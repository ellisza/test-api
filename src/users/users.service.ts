import { Injectable } from '@nestjs/common';

export interface TikTokProfile {
  open_id: string;
  display_name?: string;
  avatar_url?: string;
  stats?: {
    follower_count?: number;
    following_count?: number;
    likes_count?: number;
    video_count?: number;
  };
  raw?: any;
}

export interface TikTokTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
}

export interface UserRecord {
  uid: string;
  displayName?: string;
  avatarUrl?: string;
  providers: {
    tiktok?: {
      openId: string;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      refreshExpiresIn?: number;
      profile: TikTokProfile;
    };
  };
}

@Injectable()
export class UsersService {
  private readonly uidToUser = new Map<string, UserRecord>();
  private readonly tiktokOpenIdToUid = new Map<string, string>();

  async upsertByTikTok(profile: TikTokProfile, tokens: TikTokTokens): Promise<UserRecord> {
    const existingUid = this.tiktokOpenIdToUid.get(profile.open_id);
    const uid = existingUid ?? this.generateUidFromDisplayName(profile.display_name, profile.open_id);

    const existing = this.uidToUser.get(uid);
    const user: UserRecord = {
      uid,
      displayName: profile.display_name || existing?.displayName,
      avatarUrl: profile.avatar_url || existing?.avatarUrl,
      providers: {
        ...(existing?.providers ?? {}),
        tiktok: {
          openId: profile.open_id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          refreshExpiresIn: tokens.refresh_expires_in,
          profile,
        },
      },
    };

    this.uidToUser.set(uid, user);
    this.tiktokOpenIdToUid.set(profile.open_id, uid);
    return user;
  }

  async linkTikTokToUser(uid: string, profile: TikTokProfile, tokens: TikTokTokens): Promise<UserRecord> {
    const existing = this.uidToUser.get(uid) ?? { uid, providers: {} } as UserRecord;
    const updated: UserRecord = {
      ...existing,
      displayName: profile.display_name || existing.displayName,
      avatarUrl: profile.avatar_url || existing.avatarUrl,
      providers: {
        ...existing.providers,
        tiktok: {
          openId: profile.open_id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          refreshExpiresIn: tokens.refresh_expires_in,
          profile,
        },
      },
    };

    this.uidToUser.set(uid, updated);
    this.tiktokOpenIdToUid.set(profile.open_id, uid);
    return updated;
  }

  private generateUidFromDisplayName(displayName: string | undefined, openId: string): string {
    const baseName = (displayName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    let candidate = `ttk_${baseName || openId}`;
    // Ensure not too long
    if (candidate.length > 120) {
      candidate = candidate.slice(0, 120);
    }
    // Avoid collision with a different user
    if (this.uidToUser.has(candidate)) {
      const suffix = `_${openId.slice(-6)}`;
      candidate = `${candidate}${suffix}`.slice(0, 128);
    }
    return candidate;
  }
}
