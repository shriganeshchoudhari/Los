import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initTracing, shutdownTracing, TracingMiddleware } from '@los/common';

async function bootstrap() {
  initTracing('integration-service');

  const logger = new Logger('IntegrationService');
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
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
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
    .setTitle('LOS Integration Service')
    .setDescription('Integration gateway: CBS (Finacle), Credit Bureaus (CIBIL/Experian/Equifax/CRIF), NPCI Payments (IMPS/NEFT/RTGS/UPI/NACH)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3006;

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await shutdownTracing();
    await app.close();
    process.exit(0);
  });

  await app.listen(port);
  logger.log(`Integration Service running on port ${port}`);
  logger.log(`Swagger: http://localhost:${port}/api`);
}
bootstrap();
