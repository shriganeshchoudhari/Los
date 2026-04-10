import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

@Injectable()
export class MinIOService implements OnModuleInit {
  private readonly logger = new Logger(MinIOService.name);
  private readonly client: Client;
  private readonly bucketName: string;
  private readonly presignedUrlExpiry = 900;

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: this.configService.get<number>('MINIO_PORT', 9000),
      useSSL: this.configService.get<boolean>('MINIO_USE_SSL', false),
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'los-agreements');
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
        this.logger.log(`Bucket ${this.bucketName} created`);
      }
    } catch (error) {
      this.logger.warn(`MinIO bucket check failed: ${error.message}. Storage operations may fail.`);
    }
  }

  async getPresignedUploadUrl(
    objectKey: string,
    mimeType: string,
    expirySeconds = 900,
  ): Promise<{ url: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);
    const url = await this.client.presignedPutObject(
      this.bucketName,
      objectKey,
      expirySeconds,
      { 'Content-Type': mimeType },
    );
    return { url, expiresAt };
  }

  async getPresignedDownloadUrl(objectKey: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucketName, objectKey, expirySeconds);
  }

  async uploadBuffer(objectKey: string, buffer: Buffer, mimeType = 'application/pdf'): Promise<string> {
    await this.client.putObject(this.bucketName, objectKey, buffer, {
      'Content-Type': mimeType,
    });
    return objectKey;
  }

  async getObject(objectKey: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const stream = await this.client.getObject(this.bucketName, objectKey);
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucketName, objectKey);
  }

  generateObjectKey(applicationId: string, fileName: string): string {
    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '.pdf';
    return `agreements/${applicationId}/${Date.now()}${ext}`;
  }
}
