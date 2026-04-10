import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { pipeline } from 'stream/promises';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import PDFDocument from 'pdfkit';

const WATERMARK_TEXT = 'FOR LOAN PURPOSE ONLY';

@Injectable()
export class MinIOService {
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
    this.bucketName = this.configService.get<string>('MINIO_BUCKET', 'los-documents');
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucketName);
    if (!exists) {
      await this.client.makeBucket(this.bucketName);
      this.logger.log(`Bucket ${this.bucketName} created`);
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

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucketName, objectKey);
  }

  async getObject(objectKey: string): Promise<Buffer> {
    const chunks: Buffer[] = [];
    const stream = await this.client.getObject(this.bucketName, objectKey);
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async generateChecksum(buffer: Buffer): Promise<string> {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  async watermarkAndUpload(
    sourceObjectKey: string,
    destinationObjectKey: string,
    applicationNo: string,
    mimeType: string,
  ): Promise<string> {
    const sourceBuffer = await this.getObject(sourceObjectKey);
    const tempDir = path.join('/tmp', 'watermarks');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempInput = path.join(tempDir, `input_${Date.now()}.tmp`);
    const tempOutput = path.join(tempDir, `output_${Date.now()}.tmp`);

    try {
      fs.writeFileSync(tempInput, sourceBuffer);

      if (mimeType === 'application/pdf') {
        await this.watermarkPdf(tempInput, tempOutput, applicationNo);
      } else if (mimeType.startsWith('image/')) {
        await this.watermarkImage(tempInput, tempOutput, applicationNo);
      } else {
        fs.copyFileSync(tempInput, tempOutput);
      }

      const watermarkedBuffer = fs.readFileSync(tempOutput);
      await this.client.putObject(this.bucketName, destinationObjectKey, watermarkedBuffer, {
        'Content-Type': mimeType,
        'x-amz-meta-watermarked': 'true',
        'x-amz-meta-application': applicationNo,
      });

      return destinationObjectKey;
    } finally {
      if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
      if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
    }
  }

  private async watermarkPdf(inputPath: string, outputPath: string, applicationNo: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const readStream = fs.createReadStream(inputPath);
        const pdfDoc = new PDFDocument({ autoFirstPage: false });
        const writeStream = fs.createWriteStream(outputPath);
        const output = fs.createWriteStream(outputPath);

        let pageNum = 0;
        pdfDoc.on('page', (page) => {
          pageNum++;
          const { width, height } = page;
          const watermarkText = `${WATERMARK_TEXT} – ${applicationNo}`;
          const fontSize = 10;

          pdfDoc
            .fontSize(fontSize)
            .fillColor('#888888')
            .text(watermarkText, 40, height - 40, {
              width: width - 80,
              align: 'right',
            });

          pdfDoc
            .fontSize(8)
            .fillColor('#aaaaaa')
            .text(
              `Page ${pageNum}`,
              40,
              height - 55,
              { width: width - 80, align: 'right' },
            );
        });

        pdfDoc.on('end', () => resolve());
        pdfDoc.on('error', reject);

        pipeline(readStream, pdfDoc, output).catch(reject);
      } catch (err) {
        fs.copyFileSync(inputPath, outputPath);
        resolve();
      }
    });
  }

  private async watermarkImage(inputPath: string, outputPath: string, applicationNo: string): Promise<void> {
    try {
      const sharp = require('sharp');
      const metadata = await sharp(inputPath).metadata();
      const textWidth = Math.max(metadata.width * 0.8, 400);
      const svgText = `
        <svg width="${metadata.width}" height="${metadata.height}">
          <style>
            .watermark {
              font-family: Arial, sans-serif;
              font-size: 14px;
              fill: rgba(128, 128, 128, 0.3);
            }
          </style>
          <text
            x="50%"
            y="${metadata.height - 20}"
            text-anchor="middle"
            class="watermark"
            transform="rotate(-30, ${metadata.width / 2}, ${metadata.height / 2})"
          >
            ${WATERMARK_TEXT} – ${applicationNo}
          </text>
        </svg>
      `;

      await sharp(inputPath)
        .composite([
          {
            input: Buffer.from(svgText),
            top: 0,
            left: 0,
          },
        ])
        .toFile(outputPath);
    } catch {
      fs.copyFileSync(inputPath, outputPath);
    }
  }

  generateObjectKey(applicationId: string, documentType: string, fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(`${applicationId}-${documentType}-${timestamp}`).digest('hex').substring(0, 8);
    return `applications/${applicationId}/${documentType}/${hash}${ext}`;
  }

  getWatermarkedObjectKey(originalKey: string): string {
    const parts = originalKey.split('/');
    const fileName = parts.pop();
    return [...parts, 'watermarked', fileName].join('/');
  }
}
