import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, MetricsModule } from '@los/common';
import { IntegrationController } from './controllers/integration.controller';
import { HealthController } from './controllers/health.controller';
import { TrancheController } from './controllers/tranche.controller';
import { MetricsController } from './controllers/metrics.controller';
import { IntegrationService } from './services/integration.service';
import { TrancheService } from './services/tranche.service';
import { CibilClient, ExperianClient, EquifaxClient, CrifClient } from './clients/bureau-clients';
import { CBSClient } from './clients/cbs-client';
import { IMPSClient, NEFTClient, RTGSClient, UPIClient, NACHClient } from './clients/npci-clients';
import {
  BureauPullJob,
  BureauReport,
  BureauAggregatedScore,
} from './entities/bureau.entity';
import { Disbursement, PaymentTransaction, NACHMandate } from './entities/payment.entity';
import { DisbursementTranche, DisbursementPlan, DisbursementInspection } from './entities/tranche.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'los_integration',
      entities: [BureauPullJob, BureauReport, BureauAggregatedScore, Disbursement, PaymentTransaction, NACHMandate, DisbursementTranche, DisbursementPlan, DisbursementInspection],
      synchronize: false,
      logging: ['error', 'warn'],
    }),
    TypeOrmModule.forFeature([
      BureauPullJob,
      BureauReport,
      BureauAggregatedScore,
      Disbursement,
      PaymentTransaction,
      NACHMandate,
      DisbursementTranche,
      DisbursementPlan,
      DisbursementInspection,
    ]),
    KafkaModule,
    MetricsModule,
  ],
  controllers: [IntegrationController, HealthController, TrancheController, MetricsController],
  providers: [
    IntegrationService,
    TrancheService,
    CibilClient,
    ExperianClient,
    EquifaxClient,
    CrifClient,
    CBSClient,
    IMPSClient,
    NEFTClient,
    RTGSClient,
    UPIClient,
    NACHClient,
  ],
  exports: [IntegrationService, TrancheService],
})
export class IntegrationModule {}
