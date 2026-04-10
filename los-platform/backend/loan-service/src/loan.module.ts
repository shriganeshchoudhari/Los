import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule, MetricsModule } from '@los/common';
import {
  LoanApplicationController,
  SanctionLetterController,
  LoanAgreementController,
  EmiCalculatorController,
  PddController,
  MetricsController,
  AuditLogController,
} from './controllers';
import {
  LoanApplicationService,
  SanctionLetterService,
  LoanAgreementService,
  EmiCalculatorService,
  PddService,
  eSignService,
  MinIOService,
  EsignEventListener,
  PddEventListener,
  PddSchedulerService,
} from './services';
import {
  LoanApplication,
  ApplicationStageHistory,
  PddChecklist,
  PddChecklistItem,
  LoanAgreement,
  LoanAgreementSignature,
} from './entities';

@Module({
  imports: [
    HttpModule,
    AuditModule,
    MetricsModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      LoanApplication,
      ApplicationStageHistory,
      PddChecklist,
      PddChecklistItem,
      LoanAgreement,
      LoanAgreementSignature,
    ]),
  ],
  controllers: [
    LoanApplicationController,
    SanctionLetterController,
    LoanAgreementController,
    EmiCalculatorController,
    PddController,
    MetricsController,
    AuditLogController,
  ],
  providers: [
    LoanApplicationService,
    SanctionLetterService,
    LoanAgreementService,
    EmiCalculatorService,
    PddService,
    eSignService,
    MinIOService,
    EsignEventListener,
    PddEventListener,
    PddSchedulerService,
  ],
  exports: [
    LoanApplicationService,
    SanctionLetterService,
    LoanAgreementService,
    EmiCalculatorService,
    PddService,
    eSignService,
  ],
})
export class LoanModule {}
