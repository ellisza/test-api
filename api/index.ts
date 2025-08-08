import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';

let cachedExpressHandler: any | null = null;

async function bootstrapServer(): Promise<any> {
  if (cachedExpressHandler) return cachedExpressHandler;

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableCors();
  await app.init();

  const expressInstance = app.getHttpAdapter().getInstance();
  cachedExpressHandler = (req: any, res: any) => {
    // Strip "/api" prefix when invoked under Vercel API routes, so Nest sees paths like "/auth/*"
    if (typeof req.url === 'string' && req.url.startsWith('/api')) {
      req.url = req.url.slice(4) || '/';
    }
    return expressInstance(req, res);
  };
  return cachedExpressHandler;
}

export default async function handler(req: any, res: any) {
  const server = await bootstrapServer();
  return server(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

