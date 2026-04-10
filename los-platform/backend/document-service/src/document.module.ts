import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuditModule, MetricsModule } from '@los/common';
import { Document, DocumentChecklist, DocumentReview } from './entities';
import { DocumentService, MinIOService, OcrService } from './services';
import { DocumentController } from './controllers/document.controller';
import { MetricsController } from './controllers/metrics.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditModule,
    MetricsModule,
    TypeOrmModule.forFeature([Document, DocumentChecklist, DocumentReview]),
  ],
  controllers: [DocumentController, MetricsController],
  providers: [DocumentService, MinIOService, OcrService],
  exports: [DocumentService],
})
export class DocumentModule {}
