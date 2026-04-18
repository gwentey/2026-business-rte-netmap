import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://*.tile.openstreetmap.org', 'https://*.openstreetmap.org'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
        },
      },
    }),
  );
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: false,
  });
  app.setGlobalPrefix('api');

  const port = Number.parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
}

void bootstrap();
