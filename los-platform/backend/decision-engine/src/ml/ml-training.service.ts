import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MLModelRegistry, MLPredictionLog } from './entities/ml-model.entity';
import { FeatureEngineeringService } from './feature-engineering.service';
import {
  TrainingConfig,
  TrainingResult,
  ModelPerformance,
  ValidationResult,
  ModelStatus,
  ModelType,
} from './ml.types';

@Injectable()
export class MLTrainingService {
  private readonly logger = new Logger(MLTrainingService.name);

  constructor(
    @InjectRepository(MLModelRegistry)
    private readonly modelRepo: Repository<MLModelRegistry>,
    @InjectRepository(MLPredictionLog)
    private readonly predictionLogRepo: Repository<MLPredictionLog>,
    private readonly featureEngineering: FeatureEngineeringService,
  ) {}

  async trainModel(config: TrainingConfig): Promise<TrainingResult> {
    const modelId = `${config.modelId}_v${Date.now()}`;
    const startTime = Date.now();

    try {
      const { xs, ys } = await this.loadTrainingData(config);
      const { mean, std } = this.computeNormalizationParams(xs);

      const normalized = this.normalizeFeatures(xs, mean, std);
      const { trainX, valX, trainY, valY } = this.trainValSplit(normalized, ys, config.trainSplit);

      const coefficients = this.logisticRegressionFit(trainX, trainY, {
        epochs: config.epochs ?? 100,
        learningRate: config.learningRate ?? 0.01,
        regularization: config.regularization ?? 0.001,
      });

      const trainPredictions = this.predictBatch(trainX, coefficients);
      const valPredictions = this.predictBatch(valX, coefficients);

      const validationResults = this.computeValidationMetrics(valY, valPredictions);
      const featureImportances = this.computeFeatureImportances(coefficients, std);

      const modelEntity = this.modelRepo.create({
        modelId: config.modelId,
        version: `v${Date.now()}`,
        modelName: `${config.modelId} ML Scorecard`,
        modelType: config.modelType as any,
        status: ModelStatus.VALIDATED as any,
        loanSegment: config.loanSegment,
        loanProducts: config.loanProducts,
        featureNames: config.features,
        scalerMean: mean,
        scalerStd: std,
        coefficients: coefficients.map(c => [c]),
        intercepts: [0],
        featureImportances,
        performanceMetrics: {
          gini: this.gini(validationResults),
          ks: this.ksStatistic(valY, valPredictions),
          auc: this.auc(validationResults),
          accuracy: this.accuracy(valY, valPredictions),
          precision: this.precision(valY, valPredictions),
          recall: this.recall(valY, valPredictions),
          f1: this.f1Score(valY, valPredictions),
          defaultThreshold: 0.5,
        },
        trainingDatasetSize: trainX.length,
        trainingHistory: [],
        trainedBy: 'SYSTEM',
        trainedAt: new Date(),
        validationDate: new Date(),
      });

      await this.modelRepo.save(modelEntity);

      return {
        modelId: config.modelId,
        version: modelEntity.version,
        status: ModelStatus.VALIDATED,
        performance: {
          modelId: config.modelId,
          version: modelEntity.version,
          gini: this.gini(validationResults),
          ks: this.ksStatistic(valY, valPredictions),
          auc: this.auc(validationResults),
          accuracy: this.accuracy(valY, valPredictions),
          precision: this.precision(valY, valPredictions),
          recall: this.recall(valY, valPredictions),
          f1: this.f1Score(valY, valPredictions),
          defaultThreshold: 0.5,
          validationDate: new Date(),
          performanceDate: new Date(),
        },
        featureImportances,
        trainingHistory: [],
        validationResults,
        errors: [],
        completedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Model training failed: ${error.message}`);
      return {
        modelId: config.modelId,
        version: '',
        status: ModelStatus.FAILED,
        performance: {} as any,
        featureImportances: {},
        trainingHistory: [],
        validationResults: {
          confusionMatrix: [],
          rocCurve: [],
          precisionRecallCurve: [],
          calibrationCurve: [],
        },
        errors: [error.message],
        completedAt: new Date(),
      };
    }
  }

  async loadTrainingData(config: TrainingConfig): Promise<{ xs: number[][]; ys: number[] }> {
    const historicalPredictions = await this.predictionLogRepo
      .createQueryBuilder('log')
      .where('log.actual_outcome IS NOT NULL')
      .andWhere('log.outcome_date IS NOT NULL')
      .andWhere('log.outcome_date < :cutoff', { cutoff: new Date() })
      .orderBy('log.predictedAt', 'DESC')
      .limit(10000)
      .getMany();

    if (historicalPredictions.length < 100) {
      return this.generateSyntheticData();
    }

    const xs: number[][] = [];
    const ys: number[] = [];

    for (const pred of historicalPredictions) {
      const features = Object.values(pred.inputFeatures);
      if (features.length !== this.featureEngineering.getFeatureCount()) continue;

      const defaulted = pred.actualOutcome === 'DEFAULT'
        || (pred.daysToDefault !== null && pred.daysToDefault <= 90);
      xs.push(features as number[]);
      ys.push(defaulted ? 1 : 0);
    }

    return { xs, ys };
  }

  private generateSyntheticData(): { xs: number[][]; ys: number[] } {
    const n = 5000;
    const xs: number[][] = [];
    const ys: number[] = [];
    const featureCount = this.featureEngineering.getFeatureCount();

    for (let i = 0; i < n; i++) {
      const bureauScore = Math.floor(Math.random() * 600) + 300;
      const scoreNormalized = (bureauScore - 300) / 600;
      const dpd90 = Math.random() < 0.05 ? 1 : 0;
      const dpd60 = dpd90 ? 0 : (Math.random() < 0.1 ? 1 : 0);
      const dpd30 = dpd60 ? 0 : (Math.random() < 0.15 ? 1 : 0);
      const emiToIncome = Math.random() * 0.8;
      const enquiry30d = Math.floor(Math.random() * 10);
      const exposureToIncome = Math.random() * 2;
      const activeAccounts = Math.floor(Math.random() * 8);

      const features = [
        bureauScore,
        scoreNormalized,
        dpd90, dpd60, dpd30,
        dpd90 ? 90 : (dpd60 ? 60 : (dpd30 ? 30 : 0)),
        Math.random() * 500000000,
        Math.random() * 500000000,
        Math.random() * 500000000,
        exposureToIncome,
        emiToIncome,
        activeAccounts,
        Math.floor(Math.random() * 5),
        activeAccounts + Math.floor(Math.random() * 5),
        Math.random() * 2,
        enquiry30d,
        Math.floor(enquiry30d * 1.5),
        Math.random() < 0.02 ? 1 : 0,
        Math.random() < 0.01 ? 1 : 0,
        Math.random() < 0.005 ? 1 : 0,
        Math.random() < 0.03 ? 1 : 0,
        Math.random() * 120,
        Math.random() * 60,
        Math.random() * 2,
        Math.random() < 0.2 ? Math.floor(Math.random() * 3) : 0,
        Math.random() < 0.1 ? Math.floor(Math.random() * 2) : 0,
      ];

      while (features.length < featureCount) features.push(0);

      const pDefault = this.syntheticPD(
        bureauScore, dpd90, dpd60,
        emiToIncome, enquiry30d, exposureToIncome
      );
      const y = Math.random() < pDefault ? 1 : 0;

      xs.push(features.slice(0, featureCount));
      ys.push(y);
    }

    return { xs, ys };
  }

  private syntheticPD(
    score: number, dpd90: number, dpd60: number,
    emiToIncome: number, enquiry: number, exposureToIncome: number
  ): number {
    let p = 0.02;
    if (score < 550) p += 0.35;
    else if (score < 650) p += 0.20;
    else if (score < 750) p += 0.08;
    if (dpd90) p += 0.40;
    if (dpd60) p += 0.20;
    p += emiToIncome * 0.15;
    p += (enquiry / 10) * 0.05;
    p += exposureToIncome * 0.03;
    return Math.min(0.95, Math.max(0.001, p));
  }

  private computeNormalizationParams(xs: number[][]): { mean: number[]; std: number[] } {
    if (xs.length === 0) return { mean: [], std: [] };
    const m = xs[0].length;
    const mean: number[] = Array(m).fill(0);
    const std: number[] = Array(m).fill(1);

    for (let j = 0; j < m; j++) {
      let sum = 0;
      for (let i = 0; i < xs.length; i++) sum += xs[i][j] || 0;
      mean[j] = sum / xs.length;
    }

    for (let j = 0; j < m; j++) {
      let sumSq = 0;
      for (let i = 0; i < xs.length; i++) {
        const diff = (xs[i][j] || 0) - mean[j];
        sumSq += diff * diff;
      }
      std[j] = Math.sqrt(sumSq / xs.length) || 1;
    }

    return { mean, std };
  }

  private normalizeFeatures(xs: number[][], mean: number[], std: number[]): number[][] {
    return xs.map(row =>
      row.map((v, j) => std[j] === 0 ? 0 : (v - mean[j]) / std[j])
    );
  }

  private trainValSplit(
    xs: number[][], ys: number[],
    trainSplit: number
  ): { trainX: number[][]; valX: number[][]; trainY: number[]; valY: number[] } {
    const indices = this.shuffle(xs.map((_, i) => i));
    const trainN = Math.floor(xs.length * trainSplit);
    const trainIdx = indices.slice(0, trainN);
    const valIdx = indices.slice(trainN);

    return {
      trainX: trainIdx.map(i => xs[i]),
      valX: valIdx.map(i => xs[i]),
      trainY: trainIdx.map(i => ys[i]),
      valY: valIdx.map(i => ys[i]),
    };
  }

  private shuffle(arr: number[]): number[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private logisticRegressionFit(
    X: number[][],
    y: number[],
    opts: { epochs: number; learningRate: number; regularization: number }
  ): number[] {
    const m = X.length;
    const n = X[0].length;
    const weights = Array(n).fill(0);
    const lr = opts.learningRate;
    const lambda = opts.regularization;

    for (let epoch = 0; epoch < opts.epochs; epoch++) {
      const gradients = Array(n).fill(0);

      for (let i = 0; i < m; i++) {
        const z = weights.reduce((sum, w, j) => sum + w * X[i][j], 0);
        const pred = this.sigmoid(z);
        const err = pred - y[i];

        for (let j = 0; j < n; j++) {
          gradients[j] += (err * X[i][j]) / m;
        }
      }

      for (let j = 0; j < n; j++) {
        gradients[j] += (lambda / m) * weights[j];
        weights[j] -= lr * gradients[j];
      }
    }

    return weights;
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
  }

  private predictBatch(X: number[][], weights: number[]): number[] {
    return X.map(row => {
      const z = weights.reduce((sum, w, j) => sum + w * (row[j] ?? 0), 0);
      return this.sigmoid(z);
    });
  }

  private computeValidationMetrics(yTrue: number[], yPred: number[]): ValidationResult {
    const threshold = 0.5;
    const yClass = yPred.map(p => p >= threshold ? 1 : 0);

    const confusionMatrix = this.confusionMatrix(yTrue, yClass);
    const rocCurve = this.rocCurve(yTrue, yPred);
    const precisionRecallCurve = this.precisionRecallCurve(yTrue, yPred);
    const calibrationCurve = this.calibrationCurve(yTrue, yPred);

    return { confusionMatrix, rocCurve, precisionRecallCurve, calibrationCurve };
  }

  private confusionMatrix(yTrue: number[], yPred: number[]): number[][] {
    let tp = 0, tn = 0, fp = 0, fn = 0;
    for (let i = 0; i < yTrue.length; i++) {
      if (yTrue[i] === 1 && yPred[i] === 1) tp++;
      else if (yTrue[i] === 0 && yPred[i] === 0) tn++;
      else if (yTrue[i] === 0 && yPred[i] === 1) fp++;
      else fn++;
    }
    return [[tn, fp], [fn, tp]];
  }

  private rocCurve(yTrue: number[], yPred: number[]): { fpr: number; tpr: number; threshold: number }[] {
    const thresholds = Array.from({ length: 100 }, (_, i) => i / 100);
    return thresholds.map(threshold => {
      const yClass = yPred.map(p => p >= threshold ? 1 : 0);
      const tp = yTrue.reduce((s, t, i) => s + (t === 1 && yClass[i] === 1 ? 1 : 0), 0);
      const fp = yTrue.reduce((s, t, i) => s + (t === 0 && yClass[i] === 1 ? 1 : 0), 0);
      const fn = yTrue.reduce((s, t, i) => s + (t === 1 && yClass[i] === 0 ? 1 : 0), 0);
      const tn = yTrue.reduce((s, t, i) => s + (t === 0 && yClass[i] === 0 ? 1 : 0), 0);
      return {
        threshold,
        fpr: fp / (fp + tn) || 0,
        tpr: tp / (tp + fn) || 0,
      };
    });
  }

  private precisionRecallCurve(
    yTrue: number[],
    yPred: number[]
  ): { precision: number; recall: number; threshold: number }[] {
    const thresholds = Array.from({ length: 100 }, (_, i) => i / 100);
    return thresholds.map(threshold => {
      const yClass = yPred.map(p => p >= threshold ? 1 : 0);
      const tp = yTrue.reduce((s, t, i) => s + (t === 1 && yClass[i] === 1 ? 1 : 0), 0);
      const fp = yTrue.reduce((s, t, i) => s + (t === 0 && yClass[i] === 1 ? 1 : 0), 0);
      const fn = yTrue.reduce((s, t, i) => s + (t === 1 && yClass[i] === 0 ? 1 : 0), 0);
      return {
        threshold,
        precision: tp / (tp + fp) || 0,
        recall: tp / (tp + fn) || 0,
      };
    });
  }

  private calibrationCurve(yTrue: number[], yPred: number[]): { predicted: number; actual: number }[] {
    const bins = Array.from({ length: 10 }, (_, i) => (i + 0.5) / 10);
    return bins.map(midpoint => {
      const idxs = yPred.map((p, i) => Math.abs(p - midpoint) < 0.05 ? i : -1).filter(i => i >= 0);
      if (idxs.length === 0) return { predicted: midpoint, actual: midpoint };
      const actual = idxs.reduce((s, i) => s + yTrue[i], 0) / idxs.length;
      return { predicted: midpoint, actual };
    });
  }

  private computeFeatureImportances(weights: number[], std: number[]): Record<string, number> {
    const featureNames = this.featureEngineering.getFeatureNames();
    const importances: Record<string, number> = {};
    for (let j = 0; j < featureNames.length && j < weights.length; j++) {
      importances[featureNames[j]] = Math.abs(weights[j] * (std[j] || 1));
    }
    const maxImp = Math.max(...Object.values(importances), 0.001);
    for (const key of Object.keys(importances)) {
      importances[key] = importances[key] / maxImp;
    }
    return importances;
  }

  private gini(vr: ValidationResult): number {
    const auc = this.auc(vr);
    return Math.max(0, 2 * auc - 1);
  }

  private auc(vr: ValidationResult): number {
    const sorted = [...vr.rocCurve].sort((a, b) => a.fpr - b.fpr);
    let area = 0;
    for (let i = 1; i < sorted.length; i++) {
      area += (sorted[i].fpr - sorted[i - 1].fpr) * (sorted[i].tpr + sorted[i - 1].tpr) / 2;
    }
    return area;
  }

  private ksStatistic(yTrue: number[], yPred: number[]): number {
    const sorted = yTrue.map((t, i) => ({ t, p: yPred[i] }))
      .sort((a, b) => a.p - b.p);
    let cumDefault = 0, cumNonDefault = 0;
    const nDefault = yTrue.reduce((s, t) => s + t, 0);
    const nNonDefault = yTrue.length - nDefault;
    let maxKS = 0;
    for (const { t, p } of sorted) {
      if (t === 1) cumDefault++;
      else cumNonDefault++;
      const ks = Math.abs((cumDefault / (nDefault || 1)) - (cumNonDefault / (nNonDefault || 1)));
      maxKS = Math.max(maxKS, ks);
    }
    return maxKS;
  }

  private accuracy(yTrue: number[], yPred: number[]): number {
    const correct = yTrue.filter((t, i) => t === (yPred[i] >= 0.5 ? 1 : 0)).length;
    return correct / yTrue.length;
  }

  private precision(yTrue: number[], yPred: number[]): number {
    const tp = yTrue.filter((t, i) => t === 1 && yPred[i] >= 0.5).length;
    const fp = yTrue.filter((t, i) => t === 0 && yPred[i] >= 0.5).length;
    return tp / (tp + fp) || 0;
  }

  private recall(yTrue: number[], yPred: number[]): number {
    const tp = yTrue.filter((t, i) => t === 1 && yPred[i] >= 0.5).length;
    const fn = yTrue.filter((t, i) => t === 1 && yPred[i] < 0.5).length;
    return tp / (tp + fn) || 0;
  }

  private f1Score(yTrue: number[], yPred: number[]): number {
    const p = this.precision(yTrue, yPred);
    const r = this.recall(yTrue, yPred);
    return (2 * p * r) / (p + r) || 0;
  }

  async activateModel(modelId: string, version: string): Promise<void> {
    await this.modelRepo.update(
      { modelId, version },
      { status: 'ACTIVE' as any, isActive: true, productionSince: new Date() }
    );
    await this.modelRepo.update(
      { modelId },
      { isActive: false }
    );
    await this.modelRepo.update(
      { modelId, version },
      { status: 'ACTIVE' as any, isActive: true }
    );
  }
}
