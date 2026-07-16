import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import type { Application } from 'express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { isSwaggerEnabled, setupSwagger } from './config/swagger.config';
import { AppLogger } from './core/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'funding/callback', method: RequestMethod.GET }],
  });
  app.use(
    helmet(
      isSwaggerEnabled()
        ? { contentSecurityPolicy: false }
        : undefined,
    ),
  );
  app.enableShutdownHooks();

  const expressApp = app.getHttpAdapter().getInstance() as Application;
  expressApp.set('trust proxy', 1);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(app.get(AppLogger)),
    new TransformResponseInterceptor(app.get(Reflector)),
  );
  setupSwagger(app);

  const port = process.env.PORT ?? 3000;
  const log = app.get(AppLogger).createContext('Bootstrap');
  log.action('API server starting', { port });
  await app.listen(port);
  log.action('API server listening', {
    port,
    swagger: isSwaggerEnabled() ? '/api/docs' : 'disabled',
  });
}

void bootstrap();
