import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initTracing, shutdownTracing, TracingMiddleware } from '@los/common';

async function bootstrap() {
  initTracing('document-service', '1.0.0');

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(TracingMiddleware);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'traceparent',
      'tracestate',
      'b3',
    ],
  });

  const config = new DocumentBuilder()
    .setTitle('LOS Document Service')
    .setDescription('Document management, OCR, watermarking for loan applications')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully...');
    await shutdownTracing();
    await app.close();
    process.exit(0);
  });

  const port = process.env.PORT || 3009;
  await app.listen(port);
  logger.log(`Document service running on port ${port}`);
}
bootstrap();
