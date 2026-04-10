import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initTracing, shutdownTracing, TracingMiddleware } from '@los/common';

async function bootstrap() {
  initTracing('dsa-service');

  const logger = new Logger('DSAService');
  const app = await NestFactory.create(AppModule);

  app.use(TracingMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    exposedHeaders: ['X-Trace-Id', 'X-Span-Id'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Idempotency-Key',
      'traceparent',
      'tracestate',
      'b3',
      'X-B3-TraceId',
      'X-B3-SpanId',
      'X-B3-Sampled',
    ],
  });

  const config = new DocumentBuilder()
    .setTitle('LOS DSA Portal Service')
    .setDescription('DSA Partner onboarding, application sourcing, officer management, and commission tracking')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('DSA Portal', 'Partner registration, login, dashboard, applications, commissions')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3008;

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await shutdownTracing();
    await app.close();
    process.exit(0);
  });

  await app.listen(port);
  logger.log(`DSA Service running on port ${port}`);
  logger.log(`Swagger: http://localhost:${port}/api`);
}
bootstrap();
