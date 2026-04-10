import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import {
  DecisionResult,
  DecisionRuleResult,
  DecisionStatus,
  DecisionType,
} from '../entities/decision.entity';
import { LoanProductConfig, BenchmarkRate } from '../entities/product.entity';
import {
  TriggerDecisionDto,
  ManualDecisionDto,
  DecisionResponseDto,
  ApplicationContextDto,
  OverrideRequestDto,
  OverrideApproveDto,
  OverrideRequestResponseDto,
} from '../dto';
import { createError, AuditService, AuditEventCategory, AuditEventType } from '@los/common';
import { RuleEvaluatorService, RuleEngineResult } from '../rules/rule-evaluator.service';
import { RuleEngineConfigService } from '../rules/rule-engine-config.service';
import { PolicyVersioningService } from '../rules/policy-versioning.service';
import { MLInferenceService } from '../ml/ml-inference.service';
import {
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleOutcome,
  ScorecardResultDto,
} from '../rules/rule.types';
import { MLPredictionResult, RecommendedAction, RiskLevel } from '../ml/ml.types';
import { InterestRateService } from '../rates/interest-rate.service';
import { RateCalculationInput, CreditGrade } from '../rates/rate.types';
import { ApplicationContextService } from '../clients/application-context.service';

@Injectable()
export class DecisionEngineService {
  private readonly logger = new Logger(DecisionEngineService.name);
  private readonly kafka: Kafka;

  constructor(
    @InjectRepository(DecisionResult)
    private readonly decisionRepository: Repository<DecisionResult>,
    @InjectRepository(DecisionRuleResult)
    private readonly ruleResultRepository: Repository<DecisionRuleResult>,
    @InjectRepository(LoanProductConfig)
    private readonly productConfigRepository: Repository<LoanProductConfig>,
    @InjectRepository(BenchmarkRate)
    private readonly benchmarkRepository: Repository<BenchmarkRate>,
    private readonly configService: ConfigService,
    private readonly ruleEvaluator: RuleEvaluatorService,
    private readonly ruleConfig: RuleEngineConfigService,
    private readonly policyVersioning: PolicyVersioningService,
    private readonly mlInference: MLInferenceService,
    private readonly interestRateService: InterestRateService,
    private readonly auditService: AuditService,
    private readonly appCtxService: ApplicationContextService,
  ) {
    this.kafka = new Kafka({
      clientId: 'decision-engine',
      brokers: configService.get<string[]>('KAFKA_BROKERS', ['localhost:9092']),
    });
  }

  async triggerDecision(dto: TriggerDecisionDto): Promise<DecisionResponseDto> {
    const existingDecision = await this.decisionRepository.findOne({
      where: { applicationId: dto.applicationId },
    });

    if (existingDecision && existingDecision.status !== DecisionStatus.PENDING && !dto.forceRerun) {
      throw createError('DEC_002', 'Decision already exists. Use forceRerun to override.');
    }

    const applicationContext = await this.appCtxService.buildApplicationContext(dto.applicationId);

    if (!applicationContext) {
      throw createError('DEC_001', 'Insufficient data to run decisioning');
    }

    const productConfig = await this.getProductConfig(applicationContext.loanType);
    if (!productConfig) {
      throw createError('DEC_001', `Product config not found for ${applicationContext.loanType}`);
    }

    const benchmarkRates = await this.benchmarkRepository.find();

    const ctx: RuleEvaluationContext = {
      applicationId: applicationContext.applicationId,
      loanType: applicationContext.loanType,
      channelCode: applicationContext.channelCode || 'BRANCH',
      requestedAmount: applicationContext.requestedAmount,
      requestedTenureMonths: applicationContext.requestedTenureMonths,
      applicantAge: applicationContext.applicantAge,
      employmentType: applicationContext.employmentType,
      grossMonthlyIncome: applicationContext.grossMonthlyIncome,
      netMonthlyIncome: applicationContext.netMonthlyIncome,
      totalAnnualIncome: applicationContext.totalAnnualIncome,
      collateralValue: applicationContext.collateralValue,
      bureauData: applicationContext.bureauData,
      existingApplications: [],
      previousLoans: [],
    };

    let decision = existingDecision || this.decisionRepository.create({
      applicationId: dto.applicationId,
      status: DecisionStatus.IN_PROGRESS,
      decidedBy: DecisionType.RULE_ENGINE,
      policyVersion: productConfig.productCode,
    });
    decision.status = DecisionStatus.IN_PROGRESS;
    decision = await this.decisionRepository.save(decision);

    const ruleEngineResult: RuleEngineResult = await this.ruleEvaluator.evaluateAllRulesAsync(ctx, productConfig, benchmarkRates);

    const calculatedFOIR = this.calculateFOIR(
      applicationContext.netMonthlyIncome,
      applicationContext.existingEmi || 0,
      applicationContext.requestedAmount,
      applicationContext.requestedTenureMonths,
    );

    const calculatedLTV = applicationContext.collateralValue
      ? (applicationContext.requestedAmount / applicationContext.collateralValue) * 100
      : null;

    const scorecardInput = {
      creditScore: applicationContext.bureauData?.creditScore ?? 0,
      netMonthlyIncome: applicationContext.netMonthlyIncome,
      grossMonthlyIncome: applicationContext.grossMonthlyIncome,
      bureauData: applicationContext.bureauData,
      employmentType: applicationContext.employmentType,
      requestedAmount: applicationContext.requestedAmount,
      tenure: applicationContext.requestedTenureMonths,
      foir: calculatedFOIR,
      ltv: calculatedLTV ?? undefined,
    };

    let mlResult: MLPredictionResult | null = null;
    try {
      mlResult = await this.mlInference.predict(
        ctx,
        dto.applicationId,
        this.getLoanSegment(applicationContext.employmentType),
      );
    } catch (err) {
      this.logger.warn(`ML inference failed: ${err.message}`);
    }

    const scorecardOutput = this.ruleEvaluator.calculateScorecard(scorecardInput);
    const mlPd = mlResult?.probabilityOfDefault ?? scorecardOutput.predictionProbability;
    const mlScore = mlResult?.score ?? scorecardOutput.totalScore;
    const mlGrade = mlResult?.grade ?? scorecardOutput.grade;

    const combinedPd = mlResult
      ? mlPd * 0.6 + scorecardOutput.predictionProbability * 0.4
      : scorecardOutput.predictionProbability;
    const combinedScore = mlResult
      ? Math.round(mlScore * 0.6 + scorecardOutput.totalScore * 0.4)
      : scorecardOutput.totalScore;

    const finalGrade = combinedScore >= 850 ? 'A+' :
                       combinedScore >= 780 ? 'A' :
                       combinedScore >= 700 ? 'B+' :
                       combinedScore >= 620 ? 'B' :
                       combinedScore >= 550 ? 'C' :
                       combinedScore >= 450 ? 'D' : 'F';

    const scorecardResult: ScorecardResultDto = {
      modelId: mlResult?.modelId ?? 'LOS_SCORECARD_V2',
      modelVersion: mlResult?.version ?? '2.0.0',
      totalScore: combinedScore,
      maxScore: 1000,
      grade: finalGrade,
      bandLabel: mlResult?.band ?? scorecardOutput.bandLabel,
      predictionProbability: combinedPd,
      factorScores: scorecardOutput.factorScores,
      mlPd: mlResult?.probabilityOfDefault,
      mlGrade: mlResult?.grade,
      mlScore: mlResult?.score,
      mlRiskLevel: mlResult?.riskLevel,
      mlConfidence: mlResult?.confidence,
      mlExplanations: mlResult?.explanation,
      ensembleWeights: { mlWeight: mlResult ? 0.6 : 0, ruleWeight: mlResult ? 0.4 : 1 },
    };

    const approvedAmount = this.calculateApprovedAmount(applicationContext, productConfig);
    const approvedTenure = this.calculateApprovedTenure(applicationContext, productConfig);

    const rateInput: RateCalculationInput = {
      productCode: productConfig.productCode,
      loanType: applicationContext.loanType,
      approvedAmount,
      approvedTenureMonths: approvedTenure,
      creditGrade: finalGrade as CreditGrade,
      bureauScore: applicationContext.bureauData?.creditScore ?? 650,
      employmentType: applicationContext.employmentType,
      grossMonthlyIncome: applicationContext.grossMonthlyIncome,
      isSalaried: applicationContext.employmentType.startsWith('SALARIED'),
      employerCategory: applicationContext.employerCategory,
    };
    const rateResult = await this.interestRateService.calculateRate(rateInput);
    await this.interestRateService.recordRate(dto.applicationId, rateInput, rateResult);

    decision.foirActual = calculatedFOIR;
    decision.ltvRatio = calculatedLTV;
    decision.rateOfInterestBps = rateResult.finalRateBps;
    decision.benchmarkRate = rateResult.benchmarkType;
    decision.spreadBps = rateResult.totalSpreadBps;
    decision.processingFeePaisa = Math.round(approvedAmount * productConfig.processingFeePercent / 10000);

    if (ruleEngineResult.shouldReject) {
      decision.status = DecisionStatus.REJECTED;
      decision.finalDecision = 'REJECT';
      decision.rejectionReasonCode = ruleEngineResult.hardStopFailures[0]?.rejectionCode || 'POLICY_DEVIATION';
      decision.rejectionRemarks = ruleEngineResult.hardStopFailures.map(f => f.message).join('; ');
    } else if (
      ruleEngineResult.shouldRefer ||
      finalGrade === 'D' ||
      finalGrade === 'F' ||
      combinedPd > 0.20
    ) {
      decision.status = DecisionStatus.REFER_TO_CREDIT_COMMITTEE;
      decision.finalDecision = 'MANUAL';
    } else if (
      mlResult?.recommendedAction === RecommendedAction.CONDITIONAL_APPROVE ||
      finalGrade === 'C' ||
      finalGrade === 'B' ||
      calculatedFOIR > productConfig.maxFoir * 0.75
    ) {
      decision.status = DecisionStatus.CONDITIONALLY_APPROVED;
      decision.finalDecision = 'CONDITIONAL_APPROVE';
      decision.approvedAmount = approvedAmount;
      decision.approvedTenureMonths = approvedTenure;
      decision.conditions = [
        { conditionCode: 'INS_001', description: 'Life insurance mandatory', isMandatory: true },
      ];
      decision.insuranceMandatory = true;
      decision.interestRateType = 'FLOATING';
      if (productConfig.maxLtv && applicationContext.collateralValue) {
        decision.ltvRatio = (approvedAmount / applicationContext.collateralValue) * 100;
      }
    } else {
      decision.status = DecisionStatus.APPROVED;
      decision.finalDecision = 'APPROVE';
      decision.approvedAmount = approvedAmount;
      decision.approvedTenureMonths = approvedTenure;
      decision.interestRateType = 'FLOATING';
      if (productConfig.maxLtv && applicationContext.collateralValue) {
        decision.ltvRatio = (approvedAmount / applicationContext.collateralValue) * 100;
      }
    }

    decision.scorecardResult = {
      ...scorecardResult,
      interestRate: {
        benchmarkType: rateResult.benchmarkType,
        benchmarkRate: rateResult.benchmarkRate,
        totalSpreadBps: rateResult.totalSpreadBps,
        finalRateBps: rateResult.finalRateBps,
        finalRatePercent: rateResult.finalRatePercent,
        isRateCapped: rateResult.isRateCapped,
        rateCappingReason: rateResult.rateCappingReason,
        breakdown: rateResult.calculationBreakdown,
      },
    };
    decision.decidedAt = new Date();
    decision = await this.decisionRepository.save(decision);

    await this.auditService.log({
      eventCategory: AuditEventCategory.DECISION,
      eventType: AuditEventType.STATUS_CHANGE,
      entityType: 'DecisionResult',
      entityId: decision.id,
      metadata: {
        applicationId: dto.applicationId,
        finalDecision: decision.finalDecision,
        status: decision.status,
        approvedAmount: decision.approvedAmount,
        approvedTenureMonths: decision.approvedTenureMonths,
        rateOfInterestBps: decision.rateOfInterestBps,
        scorecardGrade: finalGrade,
        scorecardScore: combinedScore,
        rulesPassed: ruleEngineResult.passed,
        rulesFailed: ruleEngineResult.failed,
        rulesWarnings: ruleEngineResult.warnings,
        mlUsed: !!mlResult,
        evaluationTimeMs: ruleEngineResult.evaluationTimeMs,
      },
    });

    const allResults = [
      ...ruleEngineResult.passResults,
      ...ruleEngineResult.warningResults,
      ...ruleEngineResult.hardStopFailures,
      ...ruleEngineResult.skippedResults,
    ];

    for (const ruleResult of allResults) {
      const ruleEntity = this.ruleResultRepository.create({
        decisionId: decision.id,
        ruleId: ruleResult.ruleId,
        ruleName: ruleResult.ruleName,
        category: ruleResult.category,
        outcome: ruleResult.outcome,
        threshold: ruleResult.threshold,
        actualValue: ruleResult.actualValue,
        message: ruleResult.message,
        isHardStop: ruleResult.isHardStop,
      });
      await this.ruleResultRepository.save(ruleEntity);
    }

    await this.publishEvent('los.decision.completed', {
      applicationId: dto.applicationId,
      decisionId: decision.id,
      finalDecision: decision.finalDecision,
      approvedAmount: decision.approvedAmount,
      rateOfInterestBps: decision.rateOfInterestBps,
      ruleEngineSummary: {
        totalRules: ruleEngineResult.totalRules,
        passed: ruleEngineResult.passed,
        failed: ruleEngineResult.failed,
        warnings: ruleEngineResult.warnings,
        evaluationTimeMs: ruleEngineResult.evaluationTimeMs,
      },
      scorecard: {
        grade: scorecardResult.grade,
        score: scorecardResult.totalScore,
        probability: scorecardResult.predictionProbability,
      },
    });

    return this.formatDecisionResponse(decision, allResults, scorecardResult);
  }

  async getDecision(applicationId: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({
      where: { applicationId },
    });

    if (!decision) {
      throw createError('DEC_001', 'No decision found for this application');
    }

    const ruleResults = await this.ruleResultRepository.find({
      where: { decisionId: decision.id },
    });

    const mappedResults: RuleEvaluationResult[] = ruleResults.map(r => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      category: r.category as any,
      severity: 'HARD_STOP' as any,
      outcome: r.outcome as any,
      threshold: r.threshold,
      actualValue: r.actualValue,
      message: r.message,
      isHardStop: r.isHardStop,
      evaluatedAt: new Date(),
    }));

    return this.formatDecisionResponse(decision, mappedResults, decision.scorecardResult as ScorecardResultDto);
  }

  async manualOverride(dto: ManualDecisionDto, userId: string): Promise<DecisionResponseDto> {
    const decision = await this.decisionRepository.findOne({
      where: { applicationId: dto.applicationId },
    });

    if (!decision) {
      throw createError('DEC_001', 'No decision found for this application');
    }

    if (decision.status === DecisionStatus.MANUAL_OVERRIDE) {
      throw createError('DEC_002', 'Decision already overridden');
    }

    decision.status = DecisionStatus.MANUAL_OVERRIDE;
    decision.finalDecision = dto.decision;
    decision.decidedBy = DecisionType.MANUAL;
    decision.overrideBy = userId;
    decision.overrideRemarks = dto.remarks;
    decision.decidedAt = new Date();

    if (dto.decision === 'APPROVE') {
      decision.approvedAmount = dto.approvedAmount;
      decision.approvedTenureMonths = dto.approvedTenureMonths;
      decision.rateOfInterestBps = dto.rateOfInterestBps;
      decision.conditions = dto.conditions;
    } else {
      decision.rejectionReasonCode = dto.rejectionReasonCode;
      decision.rejectionRemarks = dto.remarks;
    }

    decision = await this.decisionRepository.save(decision);

    const ruleResults = await this.ruleResultRepository.find({
      where: { decisionId: decision.id },
    });

    const mappedResults: RuleEvaluationResult[] = ruleResults.map(r => ({
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      category: r.category as any,
      severity: 'HARD_STOP' as any,
      outcome: r.outcome as any,
      threshold: r.threshold,
      actualValue: r.actualValue,
      message: r.message,
      isHardStop: r.isHardStop,
      evaluatedAt: new Date(),
    }));

    return this.formatDecisionResponse(decision, mappedResults, decision.scorecardResult as ScorecardResultDto);
  }

  async requestOverride(dto: OverrideRequestDto, userId: string): Promise<OverrideRequestResponseDto> {
    const decision = await this.decisionRepository.findOne({
      where: { applicationId: dto.applicationId },
    });

    if (!decision) {
      throw createError('DEC_001', 'No decision found for this application');
    }

    const overridableStatuses = [
      DecisionStatus.APPROVED,
      DecisionStatus.CONDITIONALLY_APPROVED,
      DecisionStatus.REJECTED,
      DecisionStatus.REFER_TO_CREDIT_COMMITTEE,
    ];

    if (!overridableStatuses.includes(decision.status)) {
      throw createError('DEC_002', `Cannot request override for application in ${decision.status} status`);
    }

    if (decision.status === DecisionStatus.OVERRIDE_PENDING) {
      throw createError('DEC_002', 'Override request already pending for this application');
    }

    const authorityLimits: Record<string, number> = {
      LOAN_OFFICER: 0,
      BRANCH_MANAGER: 5,
      ZONAL_CREDIT_HEAD: 20,
      CREDIT_ANALYST: 50,
    };
    const userLimit = authorityLimits[dto.authorityLevel] ?? 0;

    const originalAmount = decision.approvedAmount || 0;
    const requestedAmount = dto.requestedAmount || originalAmount;
    const deviationPercent = Math.abs((requestedAmount - originalAmount) / originalAmount) * 100;

    if (deviationPercent > userLimit) {
      throw createError('DEC_002', `Amount deviation of ${deviationPercent.toFixed(1)}% exceeds your authority limit of ${userLimit}%`);
    }

    decision.status = DecisionStatus.OVERRIDE_PENDING;
    decision.overrideRequestBy = userId;
    decision.overrideRequestAt = new Date();
    decision.overrideRequestRemarks = dto.justification;
    decision.overrideRequestedDecision = dto.requestedDecision;
    decision.overrideRequestedAmount = dto.requestedAmount;
    decision.overrideRequestedTenure = dto.requestedTenureMonths;
    decision.overrideRequestedRateBps = dto.requestedRateBps;
    decision.overrideRequestConditions = dto.requestedConditions;
    decision.overrideRequestedRejectionCode = dto.requestedRejectionCode;
    decision.overrideAuthorityLevel = dto.authorityLevel;
    decision.overrideAttachments = dto.attachments;

    await this.decisionRepository.save(decision);

    await this.auditService.log({
      eventCategory: AuditEventCategory.DECISION,
      eventType: AuditEventType.OVERRIDE_REQUEST,
      entityType: 'DecisionResult',
      entityId: decision.id,
      actorId: userId,
      actorRole: dto.authorityLevel,
      beforeState: JSON.stringify({ status: decision.status }),
      afterState: JSON.stringify({ status: DecisionStatus.OVERRIDE_PENDING }),
      metadata: {
        applicationId: dto.applicationId,
        requestedDecision: dto.requestedDecision,
        requestedAmount: dto.requestedAmount,
        requestedTenureMonths: dto.requestedTenureMonths,
        requestedRateBps: dto.requestedRateBps,
        justification: dto.justification,
        authorityLevel: dto.authorityLevel,
        deviationPercent: deviationPercent.toFixed(2),
      },
    });

    await this.publishEvent('los.decision.override_requested', {
      applicationId: dto.applicationId,
      decisionId: decision.id,
      requestedBy: userId,
      requestedDecision: dto.requestedDecision,
      justification: dto.justification,
      authorityLevel: dto.authorityLevel,
      deviationPercent,
    });

    return {
      overrideRequestId: decision.id,
      applicationId: dto.applicationId,
      requestedDecision: dto.requestedDecision,
      requestedAmount: dto.requestedAmount,
      requestedTenureMonths: dto.requestedTenureMonths,
      requestedRateBps: dto.requestedRateBps,
      justification: dto.justification,
      authorityLevel: dto.authorityLevel,
      status: 'PENDING',
      requestedBy: userId,
      requestedAt: new Date().toISOString(),
    };
  }

  async approveOverride(dto: OverrideApproveDto, approverId: string): Promise<OverrideRequestResponseDto> {
    const decision = await this.decisionRepository.findOne({
      where: { id: dto.overrideRequestId },
    });

    if (!decision) {
      throw createError('DEC_001', 'Override request not found');
    }

    if (decision.status !== DecisionStatus.OVERRIDE_PENDING) {
      throw createError('DEC_002', 'No pending override request found');
    }

    decision.overrideApprovedBy = approverId;
    decision.overrideApprovedAt = new Date();
    decision.overrideApproverRemarks = dto.remarks;
    decision.overrideApprovalAction = dto.action;

    if (dto.action === 'APPROVED') {
      decision.status = DecisionStatus.MANUAL_OVERRIDE;
      decision.finalDecision = decision.overrideRequestedDecision;
      decision.decidedBy = DecisionType.MANUAL;
      decision.overrideBy = approverId;
      decision.overrideRemarks = dto.remarks || decision.overrideRequestRemarks;

      if (decision.overrideRequestedDecision === 'APPROVE') {
        decision.approvedAmount = dto.approvedAmount ?? decision.overrideRequestedAmount;
        decision.approvedTenureMonths = dto.approvedTenureMonths ?? decision.overrideRequestedTenure;
        decision.rateOfInterestBps = dto.approvedRateBps ?? decision.overrideRequestedRateBps;
        decision.conditions = decision.overrideRequestConditions;
      } else {
        decision.rejectionReasonCode = decision.overrideRequestedRejectionCode;
        decision.rejectionRemarks = dto.remarks || decision.overrideRequestRemarks;
      }

      decision.decidedAt = new Date();

      await this.publishEvent('los.decision.override_approved', {
        applicationId: decision.applicationId,
        decisionId: decision.id,
        approvedBy: approverId,
        requestedDecision: decision.overrideRequestedDecision,
      });
    } else {
      decision.status = decision.decidedBy === DecisionType.RULE_ENGINE
        ? (decision.finalDecision === 'REJECT' ? DecisionStatus.REJECTED : DecisionStatus.APPROVED)
        : (decision.finalDecision === 'CONDITIONAL_APPROVE' ? DecisionStatus.CONDITIONALLY_APPROVED : DecisionStatus.APPROVED);
      decision.overrideRejectedReason = dto.remarks;

      await this.publishEvent('los.decision.override_rejected', {
        applicationId: decision.applicationId,
        decisionId: decision.id,
        rejectedBy: approverId,
        reason: dto.remarks,
      });
    }

    await this.decisionRepository.save(decision);

    await this.auditService.log({
      eventCategory: AuditEventCategory.DECISION,
      eventType: dto.action === 'APPROVED' ? AuditEventType.OVERRIDE_APPROVE : AuditEventType.OVERRIDE_REJECT,
      entityType: 'DecisionResult',
      entityId: decision.id,
      actorId: approverId,
      beforeState: JSON.stringify({ status: DecisionStatus.OVERRIDE_PENDING }),
      afterState: JSON.stringify({ status: decision.status, finalDecision: decision.finalDecision }),
      metadata: {
        applicationId: decision.applicationId,
        action: dto.action,
        requestedDecision: decision.overrideRequestedDecision,
        approvedAmount: decision.approvedAmount,
        approvedTenureMonths: decision.approvedTenureMonths,
        rateOfInterestBps: decision.rateOfInterestBps,
        remarks: dto.remarks,
        requestedBy: decision.overrideRequestBy,
        authorityLevel: decision.overrideAuthorityLevel,
      },
    });

    return {
      overrideRequestId: decision.id,
      applicationId: decision.applicationId,
      requestedDecision: decision.overrideRequestedDecision,
      requestedAmount: decision.overrideRequestedAmount,
      requestedTenureMonths: decision.overrideRequestedTenure,
      requestedRateBps: decision.overrideRequestedRateBps,
      justification: decision.overrideRequestRemarks,
      authorityLevel: decision.overrideAuthorityLevel,
      status: dto.action,
      requestedBy: decision.overrideRequestBy,
      requestedAt: decision.overrideRequestAt?.toISOString(),
      approvedBy: dto.action === 'APPROVED' ? approverId : undefined,
      approvedAt: dto.action === 'APPROVED' ? new Date().toISOString() : undefined,
      approverRemarks: dto.remarks,
    };
  }

  async getOverrideRequest(requestId: string): Promise<OverrideRequestResponseDto> {
    const decision = await this.decisionRepository.findOne({ where: { id: requestId } });
    if (!decision) {
      throw createError('DEC_001', 'Override request not found');
    }
    return {
      overrideRequestId: decision.id,
      applicationId: decision.applicationId,
      requestedDecision: decision.overrideRequestedDecision,
      requestedAmount: decision.overrideRequestedAmount,
      requestedTenureMonths: decision.overrideRequestedTenure,
      requestedRateBps: decision.overrideRequestedRateBps,
      justification: decision.overrideRequestRemarks,
      authorityLevel: decision.overrideAuthorityLevel,
      status: decision.status === DecisionStatus.OVERRIDE_PENDING ? 'PENDING'
        : decision.overrideApprovalAction === 'APPROVED' ? 'APPROVED'
        : decision.overrideApprovalAction === 'REJECTED' ? 'REJECTED' : 'UNKNOWN',
      requestedBy: decision.overrideRequestBy,
      requestedAt: decision.overrideRequestAt?.toISOString(),
      approvedBy: decision.overrideApprovedBy,
      approvedAt: decision.overrideApprovedAt?.toISOString(),
      approverRemarks: decision.overrideApproverRemarks,
    };
  }

  async listPendingOverrides(
    filter?: { status?: DecisionStatus; branchCode?: string; zoneCode?: string },
  ): Promise<OverrideRequestResponseDto[]> {
    const where: any = { status: DecisionStatus.OVERRIDE_PENDING };
    const decisions = await this.decisionRepository.find({ where, order: { overrideRequestAt: 'ASC' } });

    return decisions.map(d => ({
      overrideRequestId: d.id,
      applicationId: d.applicationId,
      requestedDecision: d.overrideRequestedDecision,
      requestedAmount: d.overrideRequestedAmount,
      requestedTenureMonths: d.overrideRequestedTenure,
      requestedRateBps: d.overrideRequestedRateBps,
      justification: d.overrideRequestRemarks,
      authorityLevel: d.overrideAuthorityLevel,
      status: 'PENDING',
      requestedBy: d.overrideRequestBy,
      requestedAt: d.overrideRequestAt?.toISOString(),
    }));
  }

  private calculateFOIR(netIncome: number, existingEmi: number, newAmount: number, tenure: number): number {
    const monthlyRate = 10.5 / 12 / 100;
    const newEmi = newAmount * monthlyRate * Math.pow(1 + monthlyRate, tenure) /
                   (Math.pow(1 + monthlyRate, tenure) - 1);
    const totalObligations = existingEmi + newEmi;
    return (totalObligations / netIncome) * 100;
  }

  private calculateApprovedAmount(ctx: ApplicationContextDto, product: LoanProductConfig): number {
    let maxByIncome = ctx.netMonthlyIncome * (product.maxFoir / 100) * tenureMultiplier(ctx.requestedTenureMonths);
    maxByIncome = Math.max(0, maxByIncome - (ctx.existingEmi || 0));

    let maxByScore = product.maxAmount;
    if (ctx.bureauData?.creditScore) {
      if (ctx.bureauData.creditScore >= 800) maxByScore = Math.min(maxByScore, product.maxAmount);
      else if (ctx.bureauData.creditScore >= 700) maxByScore = Math.min(maxByScore, product.maxAmount * 0.8);
      else if (ctx.bureauData.creditScore >= 650) maxByScore = Math.min(maxByScore, product.maxAmount * 0.5);
      else maxByScore = Math.min(maxByScore, product.maxAmount * 0.3);
    }

    const approved = Math.min(
      ctx.requestedAmount,
      maxByIncome,
      maxByScore,
      product.maxAmount
    );

    return Math.floor(approved / 1000) * 1000;
  }

  private calculateApprovedTenure(ctx: ApplicationContextDto, product: LoanProductConfig): number {
    const tenure = Math.min(ctx.requestedTenureMonths, product.maxTenureMonths);
    const maxTenureByAge = (product.maxAge - ctx.applicantAge) * 12;
    return Math.min(tenure, maxTenureByAge);
  }

  private async getProductConfig(loanType: string): Promise<LoanProductConfig | null> {
    const config = await this.productConfigRepository.findOne({
      where: {
        loanType: loanType as any,
        isActive: true,
        effectiveFrom: new Date(),
      },
    });
    return config || this.createDefaultConfig(loanType);
  }

  private createDefaultConfig(loanType: string): LoanProductConfig {
    return {
      id: 'default',
      productCode: 'DEFAULT',
      loanType: loanType as any,
      minAmount: 5000000,
      maxAmount: 2500000000,
      minTenureMonths: 12,
      maxTenureMonths: 60,
      minAge: 21,
      maxAge: 65,
      minCreditScore: 650,
      maxFoir: 50,
      baseRateBps: 850,
      spreadBps: 200,
      processingFeePercent: 1,
      prepaymentPenaltyPct: 0,
      isActive: true,
      effectiveFrom: new Date(),
      createdAt: new Date(),
    } as LoanProductConfig;
  }

  private formatDecisionResponse(
    decision: DecisionResult,
    ruleResults: RuleEvaluationResult[],
    scorecard?: ScorecardResultDto,
  ): DecisionResponseDto {
    return {
      decisionId: decision.id,
      status: decision.status,
      finalDecision: decision.finalDecision || 'PENDING',
      approvedAmount: decision.approvedAmount,
      approvedTenureMonths: decision.approvedTenureMonths,
      rateOfInterestBps: decision.rateOfInterestBps || 0,
      processingFeePaisa: decision.processingFeePaisa,
      foirActual: decision.foirActual ? Number(decision.foirActual) : undefined,
      ltvRatio: decision.ltvRatio ? Number(decision.ltvRatio) : undefined,
      ruleResults: ruleResults.map(r => ({
        ruleId: r.ruleId,
        ruleName: r.ruleName,
        category: r.category,
        outcome: r.outcome,
        threshold: r.threshold,
        actualValue: r.actualValue,
        message: r.message,
        isHardStop: r.isHardStop,
      })),
      scorecardResult: scorecard || (decision.scorecardResult as ScorecardResultDto),
      conditions: decision.conditions as any[],
      rejectionReasonCode: decision.rejectionReasonCode,
      rejectionRemarks: decision.rejectionRemarks,
      decidedAt: decision.decidedAt?.toISOString() || '',
    };
  }

  private getLoanSegment(employmentType: string): string {
    if (employmentType.startsWith('SALARIED')) return 'SALARIED';
    if (employmentType.startsWith('SELF_EMPLOYED_PROFESSIONAL')) return 'SELF_EMPLOYED';
    if (employmentType.startsWith('SELF_EMPLOYED_NON_PROFESSIONAL') || employmentType.startsWith('BUSINESS')) return 'BUSINESS';
    return 'ALL';
  }

  private async publishEvent(topic: string, payload: any): Promise<void> {
    try {
      const producer = this.kafka.producer();
      await producer.connect();
      await producer.send({
        topic,
        messages: [{
          key: payload.applicationId,
          value: JSON.stringify({
            messageId: uuidv4(),
            payload,
            timestamp: new Date().toISOString(),
            version: '1.0',
          }),
        }],
      });
      await producer.disconnect();
    } catch (error) {
      this.logger.error(`Failed to publish event to ${topic}`, { error: error.message });
    }
  }
}

function tenureMultiplier(tenureMonths: number): number {
  if (tenureMonths <= 12) return 6;
  if (tenureMonths <= 24) return 12;
  if (tenureMonths <= 36) return 18;
  if (tenureMonths <= 48) return 24;
  return 30;
}
