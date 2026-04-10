import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuditModule, MetricsModule } from '@los/common';
import { KYCController, DigiLockerController, HealthController } from './controllers/kyc.controller';
import { MetricsController } from './controllers/metrics.controller';
import {
  KYCService,
  OfflineXmlKycService,
  DigiLockerService,
  KycReuseService,
} from './services';
import {
  KYCREcord,
  AadhaarKYCResult,
  PANVerificationResult,
  FaceMatchResult,
  ConsentRecord,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuditModule,
    MetricsModule,
    TypeOrmModule.forFeature([
      KYCREcord,
      AadhaarKYCResult,
      PANVerificationResult,
      FaceMatchResult,
      ConsentRecord,
    ]),
  ],
  controllers: [KYCController, DigiLockerController, HealthController, MetricsController],
  providers: [KYCService, OfflineXmlKycService, DigiLockerService, KycReuseService],
  exports: [KYCService, OfflineXmlKycService, DigiLockerService, KycReuseService],
})
export class KYCModule {}
