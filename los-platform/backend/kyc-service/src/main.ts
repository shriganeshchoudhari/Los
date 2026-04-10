import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter, initTracing, shutdownTracing, TracingMiddleware } from '@los/common';

async function bootstrap() {
  initTracing('kyc-service', '1.0.0');

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(TracingMiddleware);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3002);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGINS', '*'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'traceparent',
      'tracestate',
      'b3',
      'X-B3-TraceId',
      'X-B3-SpanId',
      'X-B3-Sampled',
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LOS Platform - KYC Service')
    .setDescription('KYC Verification API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await shutdownTracing();
    await app.close();
    process.exit(0);
  });

  await app.listen(port);
  logger.log(`KYC Service running on port ${port}`);
}

bootstrap();
