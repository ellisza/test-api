import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TikTokService } from '../tiktok/tiktok.service.js';
import { FirebaseService } from '../firebase/firebase.service.js';
import { UsersService } from '../users/users.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, TikTokService, FirebaseService, UsersService],
})
export class AuthModule {}
