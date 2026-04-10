import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuditModule, MetricsModule } from '@los/common';
import { DecisionController, HealthController } from './controllers/decision.controller';
import { MetricsController } from './controllers/metrics.controller';
import { DecisionEngineService } from './services/decision-engine.service';
import { RuleEvaluatorService } from './rules/rule-evaluator.service';
import { RuleEngineConfigService } from './rules/rule-engine-config.service';
import { RuleConditionEvaluator } from './rules/rule-condition-evaluator';
import { FeatureEngineeringService } from './ml/feature-engineering.service';
import { MLInferenceService } from './ml/ml-inference.service';
import { MLTrainingService } from './ml/ml-training.service';
import { MLController } from './controllers/ml.controller';
import { RatesController } from './rates/rates.controller';
import { PolicyVersioningController } from './controllers/policy.controller';
import { RulesAdminController } from './controllers/rules-admin.controller';
import { InterestRateService } from './rates/interest-rate.service';
import { PolicyVersioningService } from './rules/policy-versioning.service';
import { DecisionResult, DecisionRuleResult } from './entities/decision.entity';
import { LoanProductConfig, BenchmarkRate } from './entities/product.entity';
import { RuleDefinitionEntity } from './entities/rule-definition.entity';
import { MLModelRegistry, MLPredictionLog } from './ml/entities/ml-model.entity';
import { InterestRateConfig, RateHistory } from './rates/rate.entity';
import { ApplicationContextService } from './clients/application-context.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: false }),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
    MetricsModule,
    AuditModule,
    TypeOrmModule.forFeature([
      DecisionResult,
      DecisionRuleResult,
      LoanProductConfig,
      BenchmarkRate,
      RuleDefinitionEntity,
      MLModelRegistry,
      MLPredictionLog,
      InterestRateConfig,
      RateHistory,
    ]),
  ],
  controllers: [
    MetricsController,
    DecisionController,
    HealthController,
    MLController,
    RatesController,
    PolicyVersioningController,
    RulesAdminController,
  ],
  providers: [
    ApplicationContextService,
    DecisionEngineService,
    RuleEvaluatorService,
    RuleEngineConfigService,
    RuleConditionEvaluator,
    FeatureEngineeringService,
    MLInferenceService,
    MLTrainingService,
    InterestRateService,
    PolicyVersioningService,
  ],
  exports: [
    DecisionEngineService,
    RuleEvaluatorService,
    RuleEngineConfigService,
    MLInferenceService,
    FeatureEngineeringService,
    InterestRateService,
    PolicyVersioningService,
  ],
})
export class DecisionModule {}
