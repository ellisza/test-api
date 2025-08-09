import { Injectable } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, DecodedIdToken, UpdateRequest } from 'firebase-admin/auth';

function getFirebaseAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env vars');
  }
  // Handle escaped newlines in env var
  privateKey = privateKey.replace(/\\n/g, '\n');

  const credential = cert({
    projectId,
    clientEmail,
    privateKey,
  });

  return initializeApp({ credential });
}

@Injectable()
export class FirebaseService {
  private readonly app: App;

  constructor() {
    this.app = getFirebaseAdminApp();
  }

  async createCustomToken(uid: string, claims?: Record<string, unknown>): Promise<string> {
    return getAuth(this.app).createCustomToken(uid, claims);
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return getAuth(this.app).verifyIdToken(idToken);
  }

  async updateUserProfile(uid: string, opts: { displayName?: string; photoURL?: string }): Promise<void> {
    const update: UpdateRequest = {};
    if (opts.displayName !== undefined) update.displayName = opts.displayName;
    if (opts.photoURL !== undefined) update.photoURL = opts.photoURL;
    await getAuth(this.app).updateUser(uid, update);
  }
}
