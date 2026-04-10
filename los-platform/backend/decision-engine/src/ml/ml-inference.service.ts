import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MLModelRegistry, MLPredictionLog } from './entities/ml-model.entity';
import { FeatureEngineeringService } from './feature-engineering.service';
import {
  MLPredictionResult,
  ModelConfig,
  RiskLevel,
  RecommendedAction,
  MLFeature,
} from './ml.types';
import { RuleEvaluationContext } from '../rules/rule.types';

@Injectable()
export class MLInferenceService {
  private readonly logger = new Logger(MLInferenceService.name);
  private modelCache: Map<string, ModelConfig> = new Map();

  constructor(
    @InjectRepository(MLModelRegistry)
    private readonly modelRepo: Repository<MLModelRegistry>,
    @InjectRepository(MLPredictionLog)
    private readonly predictionLogRepo: Repository<MLPredictionLog>,
    private readonly featureEngineering: FeatureEngineeringService,
  ) {}

  async loadActiveModel(loanSegment: string = 'ALL'): Promise<ModelConfig | null> {
    const cacheKey = `active_${loanSegment}`;
    if (this.modelCache.has(cacheKey)) {
      return this.modelCache.get(cacheKey)!;
    }

    const model = await this.modelRepo.findOne({
      where: { isActive: true, status: 'ACTIVE' as any, loanSegment },
      order: { version: 'DESC' },
    });

    if (!model) {
      const fallback = await this.modelRepo.findOne({
        where: { isActive: true, status: 'ACTIVE' as any },
        order: { version: 'DESC' },
      });
      if (!fallback) return null;
      return this.deserializeModel(fallback);
    }

    return this.deserializeModel(model);
  }

  private deserializeModel(entity: MLModelRegistry): ModelConfig {
    const config: ModelConfig = {
      modelId: entity.modelId,
      modelType: entity.modelType as any,
      status: entity.status as any,
      weightsPath: entity.weightsPath ?? undefined,
      metadata: {
        modelId: entity.modelId,
        version: entity.version,
        modelType: entity.modelType as any,
        loanSegment: entity.loanSegment as any,
        loanProducts: entity.loanProducts ?? [],
        createdAt: entity.createdAt,
        trainedAt: entity.trainedAt ?? entity.createdAt,
        trainedBy: entity.trainedBy ?? 'SYSTEM',
        trainingDatasetSize: entity.trainingDatasetSize ?? 0,
        status: entity.status as any,
      },
      performance: entity.performanceMetrics ? {
        modelId: entity.modelId,
        version: entity.version,
        gini: entity.performanceMetrics.gini ?? 0,
        ks: entity.performanceMetrics.ks ?? 0,
        auc: entity.performanceMetrics.auc ?? 0,
        accuracy: entity.performanceMetrics.accuracy ?? 0,
        precision: entity.performanceMetrics.precision ?? 0,
        recall: entity.performanceMetrics.recall ?? 0,
        f1: entity.performanceMetrics.f1 ?? 0,
        defaultThreshold: entity.performanceMetrics.defaultThreshold ?? 0.5,
        validationDate: entity.validationDate ?? new Date(),
        performanceDate: entity.validationDate ?? new Date(),
      } : undefined,
    };

    this.modelCache.set(`active_${entity.loanSegment}`, config);
    return config;
  }

  async predict(
    ctx: RuleEvaluationContext,
    applicationId: string,
    loanSegment: string = 'ALL',
  ): Promise<MLPredictionResult> {
    const startMs = Date.now();
    const model = await this.loadActiveModel(loanSegment);

    if (!model) {
      return this.getFallbackPrediction(ctx, applicationId, Date.now() - startMs);
    }

    const features = this.featureEngineering.extractFeatures(ctx);
    const featureArray = this.featureEngineering.featuresToArray(features);
    const featureRecord = this.featureEngineering.featuresToRecord(features);

    const [z, contributions] = this.computeLogisticRegression(
      featureArray,
      model.weightsPath ? this.loadWeightsFromModel(model) : null,
    );
    const probability = this.sigmoid(z);

    const score = this.probabilityToScore(probability);
    const grade = this.scoreToGrade(score);
    const band = this.gradeToBand(grade);
    const riskLevel = this.scoreToRiskLevel(score);
    const recommendedAction = this.riskToAction(riskLevel, probability);

    const features_ = this.buildFeatureContributions(featureRecord, contributions);

    const inferenceTimeMs = Date.now() - startMs;

    const log = this.predictionLogRepo.create({
      applicationId,
      modelId: model.metadata.modelId,
      modelVersion: model.metadata.version,
      probabilityOfDefault: probability,
      score,
      grade,
      riskLevel,
      recommendedAction,
      inputFeatures: featureRecord,
      inferenceTimeMs,
      predictedAt: new Date(),
    });
    this.predictionLogRepo.save(log).catch(() => {});

    return {
      modelId: model.metadata.modelId,
      version: model.metadata.version,
      probabilityOfDefault: probability,
      score,
      grade,
      band,
      riskLevel,
      features: features_,
      modelType: model.metadata.modelType,
      inferenceTimeMs,
      explanation: this.generateExplanations(features, probability, riskLevel),
      recommendedAction,
      confidence: this.computeConfidence(probability, model.performance?.auc),
    };
  }

  private loadWeightsFromModel(model: ModelConfig): { coefficients: number[][]; intercepts: number[] } | null {
    return null;
  }

  private computeLogisticRegression(
    features: number[],
    weights: { coefficients: number[][]; intercepts: number[] } | null,
  ): [number, Record<string, number>] {
    let z = 0;
    const contributions: Record<string, number> = {};
    const featureNames = this.featureEngineering.getFeatureNames();

    const coefficients = weights?.coefficients ?? this.getDefaultCoefficients();
    const intercept = weights?.intercepts?.[0] ?? this.getDefaultIntercept();

    for (let j = 0; j < features.length && j < coefficients.length; j++) {
      const coef = coefficients[j]?.[0] ?? this.getDefaultWeight(j);
      const contrib = features[j] * coef;
      z += contrib;
      if (featureNames[j]) {
        contributions[featureNames[j]] = contrib;
      }
    }

    z += intercept;

    for (let j = features.length; j < featureNames.length; j++) {
      if (featureNames[j]) {
        contributions[featureNames[j]] = 0;
      }
    }

    return [z, contributions];
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
  }

  private probabilityToScore(probability: number): number {
    return Math.round(300 + (1 - probability) * 700);
  }

  private scoreToGrade(score: number): string {
    if (score >= 850) return 'A+';
    if (score >= 780) return 'A';
    if (score >= 700) return 'B+';
    if (score >= 620) return 'B';
    if (score >= 550) return 'C';
    if (score >= 450) return 'D';
    return 'F';
  }

  private gradeToBand(grade: string): string {
    const bandMap: Record<string, string> = {
      'A+': 'EXCELLENT',
      'A': 'VERY_GOOD',
      'B+': 'GOOD',
      'B': 'FAIR',
      'C': 'POOR',
      'D': 'VERY_POOR',
      'F': 'DEFAULT_RISK',
    };
    return bandMap[grade] ?? 'UNKNOWN';
  }

  private scoreToRiskLevel(score: number): RiskLevel {
    if (score >= 780) return RiskLevel.VERY_LOW;
    if (score >= 700) return RiskLevel.LOW;
    if (score >= 620) return RiskLevel.MEDIUM;
    if (score >= 550) return RiskLevel.HIGH;
    return RiskLevel.VERY_HIGH;
  }

  private riskToAction(risk: RiskLevel, pd: number): RecommendedAction {
    if (risk === RiskLevel.VERY_LOW) return RecommendedAction.AUTO_APPROVE;
    if (risk === RiskLevel.LOW && pd < 0.05) return RecommendedAction.AUTO_APPROVE;
    if (risk === RiskLevel.LOW || risk === RiskLevel.MEDIUM) return RecommendedAction.CONDITIONAL_APPROVE;
    if (risk === RiskLevel.HIGH) return RecommendedAction.MANUAL_REVIEW;
    return RecommendedAction.AUTO_REJECT;
  }

  private buildFeatureContributions(
    features: Record<string, number>,
    contributions: Record<string, number>,
  ): MLFeature[] {
    const featureOrder = this.featureEngineering.getFeatureNames();
    return featureOrder.map(name => ({
      name,
      value: features[name] ?? 0,
      band: this.getFeatureBand(name, features[name] ?? 0),
      contribution: contributions[name] ?? 0,
    })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }

  private getFeatureBand(name: string, value: number): string {
    const bands: Record<string, [number, string][]> = {
      bureauScore: [
        [800, 'Excellent'], [700, 'Very Good'], [650, 'Good'],
        [600, 'Fair'], [0, 'Poor'],
      ],
      dpd90Flag: [[0, 'No DPD'], [1, 'Has DPD']],
      maxDpd: [[0, 'Clean'], [30, 'Minor DPD'], [60, 'Moderate DPD'], [90, 'Severe DPD']],
      emiToIncome: [[0.3, 'Healthy'], [0.5, 'Moderate'], [1, 'High Risk']],
      enquiryVelocity30d: [[2, 'Normal'], [5, 'High'], [100, 'Very High']],
      totalExposure: [[10000000, 'Low'], [50000000, 'Medium'], [100000000, 'High']],
    };

    const def = bands[name];
    if (!def) return 'N/A';
    for (const [threshold, label] of def) {
      if (value >= threshold) return label as string;
    }
    return def[def.length - 1][1] as string;
  }

  private generateExplanations(
    features: any,
    probability: number,
    risk: RiskLevel,
  ): string[] {
    const explanations: string[] = [];

    if (features.bureauScore >= 780) {
      explanations.push(`Strong credit score of ${features.bureauScore} — low default risk`);
    } else if (features.bureauScore < 650) {
      explanations.push(`Low credit score of ${features.bureauScore} is the primary risk driver`);
    }

    if (features.dpd90Flag === 1) {
      explanations.push('90+ days past due — highest risk factor');
    }

    if (features.wilfulDefaulterFlag === 1) {
      explanations.push('Wilful defaulter flag — automatic high risk');
    }

    if (features.enquiryVelocity30d > 5) {
      explanations.push(`High enquiry velocity: ${features.enquiryVelocity30d} in 30 days — credit seeking behavior`);
    }

    if (features.emiToIncome > 0.5) {
      explanations.push(`EMI-to-income ratio of ${(features.emiToIncome * 100).toFixed(0)}% — elevated obligation`);
    }

    if (features.totalExposure > features.bureauScore * 1000) {
      explanations.push('High credit utilization relative to score');
    }

    if (explanations.length === 0) {
      explanations.push(`Probability of default: ${(probability * 100).toFixed(2)}%`);
    }

    return explanations;
  }

  private computeConfidence(auc?: number): number {
    if (!auc) return 0.7;
    return Math.min(0.99, auc);
  }

  private getFallbackPrediction(
    ctx: RuleEvaluationContext,
    applicationId: string,
    inferenceTimeMs: number,
  ): MLPredictionResult {
    const bureau = ctx.bureauData;
    const score = bureau?.creditScore ?? 500;
    const grade = this.scoreToGrade(score);
    const band = this.gradeToBand(grade);
    const risk = this.scoreToRiskLevel(score);

    return {
      modelId: 'FALLBACK_RULE_BASED',
      version: '1.0.0',
      probabilityOfDefault: score > 0 ? Math.max(0.01, (900 - score) / 700 * 0.5) : 0.5,
      score,
      grade,
      band,
      riskLevel: risk,
      features: [],
      modelType: 'LOGISTIC_REGRESSION' as any,
      inferenceTimeMs,
      explanation: ['Rule-based fallback — ML model not available. Using bureau score.'],
      recommendedAction: this.riskToAction(risk, 0.1),
      confidence: 0.5,
    };
  }

  private getDefaultCoefficients(): number[][] {
    return [
      [-0.8],   // bureauScore normalized
      [-1.2],   // scoreNormalized
      [-2.5],   // dpd90Flag
      [-1.8],   // dpd60Flag
      [-1.0],   // dpd30Flag
      [-0.05],  // maxDpd
      [0.3e-7], // totalExposure
      [0.5e-7], // unsecuredExposure
      [0.2e-7], // securedExposure
      [0.8],    // exposureToIncome
      [1.5],    // emiToIncome
      [-0.1],   // activeAccounts
      [-0.05],  // closedAccounts
      [0.02],   // totalAccounts
      [-0.05],  // accountsPerYear
      [0.15],   // enquiryVelocity30d
      [0.1],    // enquiryVelocity90d
      [-1.5],   // writeoffFlag
      [-2.0],   // suitFiledFlag
      [-2.5],   // wilfulDefaulterFlag
      [-1.2],   // disputedFlag
      [-0.01],  // creditAgeMonths
      [-0.01],  // avgTenureClosed
      [0.3],    // utilizationCredit
      [0.2],    // newAccounts6m
      [0.1],    // droppedAccounts3m
    ];
  }

  private getDefaultIntercept(): number {
    return 2.0;
  }

  private getDefaultWeight(featureIndex: number): number {
    const weights = this.getDefaultCoefficients();
    return weights[featureIndex]?.[0] ?? 0;
  }

  clearCache(): void {
    this.modelCache.clear();
    this.logger.log('Model cache cleared');
  }

  async getModelStats(modelId: string): Promise<{
    totalPredictions: number;
    avgPd: number;
    gradeDistribution: Record<string, number>;
    recentPredictions: number;
  }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const predictions = await this.predictionLogRepo
      .createQueryBuilder('log')
      .where('log.modelId = :modelId', { modelId })
      .andWhere('log.predictedAt >= :cutoff', { cutoff })
      .getMany();

    const gradeDist: Record<string, number> = {};
    let totalPd = 0;

    for (const p of predictions) {
      gradeDist[p.grade] = (gradeDist[p.grade] || 0) + 1;
      totalPd += p.probabilityOfDefault;
    }

    return {
      totalPredictions: predictions.length,
      avgPd: predictions.length > 0 ? totalPd / predictions.length : 0,
      gradeDistribution: gradeDist,
      recentPredictions: predictions.length,
    };
  }
}
