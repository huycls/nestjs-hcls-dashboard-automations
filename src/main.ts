import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { getHttpCorsOptions } from './config/cors';

async function bootstrap() {
  const dbPath = process.env.DATABASE_PATH ?? 'data/automations.sqlite';
  mkdirSync(dirname(dbPath), { recursive: true });

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors(getHttpCorsOptions());
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
