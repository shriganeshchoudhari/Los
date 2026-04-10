export enum ModelStatus {
  TRAINING = 'TRAINING',
  VALIDATED = 'VALIDATED',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  FAILED = 'FAILED',
}

export enum ModelType {
  LOGISTIC_REGRESSION = 'LOGISTIC_REGRESSION',
  RANDOM_FOREST = 'RANDOM_FOREST',
  GRADIENT_BOOSTING = 'GRADIENT_BOOSTING',
  NEURAL_NETWORK = 'NEURAL_NETWORK',
  ENSEMBLE = 'ENSEMBLE',
}

export enum LoanSegment {
  SALARIED = 'SALARIED',
  SELF_EMPLOYED = 'SELF_EMPLOYED',
  BUSINESS = 'BUSINESS',
  ALL = 'ALL',
}

export interface ModelMetadata {
  modelId: string;
  version: string;
  modelType: ModelType;
  loanSegment: LoanSegment;
  loanProducts: string[];
  createdAt: Date;
  trainedAt: Date;
  trainedBy: string;
  trainingDatasetSize: number;
  status: ModelStatus;
}

export interface ModelPerformance {
  modelId: string;
  version: string;
  gini: number;
  ks: number;
  auc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  defaultThreshold: number;
  validationDate: Date;
  populationStabilityIndex?: number;
  performanceDate: Date;
}

export interface MLFeature {
  name: string;
  value: number;
  band?: string;
  contribution: number;
}

export interface MLPredictionResult {
  modelId: string;
  version: string;
  probabilityOfDefault: number;
  score: number;
  grade: string;
  band: string;
  riskLevel: RiskLevel;
  features: MLFeature[];
  modelType: ModelType;
  inferenceTimeMs: number;
  explanation: string[];
  recommendedAction: RecommendedAction;
  confidence: number;
}

export enum RiskLevel {
  VERY_LOW = 'VERY_LOW',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  VERY_HIGH = 'VERY_HIGH',
}

export enum RecommendedAction {
  AUTO_APPROVE = 'AUTO_APPROVE',
  CONDITIONAL_APPROVE = 'CONDITIONAL_APPROVE',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  AUTO_REJECT = 'AUTO_REJECT',
}

export interface BureauDerivedFeatures {
  bureauScore: number;
  scoreNormalized: number;
  dpd90Flag: number;
  dpd60Flag: number;
  dpd30Flag: number;
  maxDpd: number;
  totalExposure: number;
  unsecuredExposure: number;
  securedExposure: number;
  exposureToIncome: number;
  emiToIncome: number;
  activeAccounts: number;
  closedAccounts: number;
  totalAccounts: number;
  accountsPerYear: number;
  enquiryVelocity30d: number;
  enquiryVelocity90d: number;
  writeoffFlag: number;
  suitFiledFlag: number;
  wilfulDefaulterFlag: number;
  disputedFlag: number;
  creditAgeMonths: number;
  avgTenureClosed: number;
  utilizationCredit: number;
  newAccounts6m: number;
  droppedAccounts3m: number;
}

export interface TrainingConfig {
  modelId: string;
  modelType: ModelType;
  loanSegment: LoanSegment;
  loanProducts: string[];
  features: string[];
  labelColumn: string;
  trainSplit: number;
  validationSplit: number;
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  regularization?: number;
  classWeights?: Record<string, number>;
}

export interface TrainingResult {
  modelId: string;
  version: string;
  status: ModelStatus;
  performance: ModelPerformance;
  featureImportances: Record<string, number>;
  trainingHistory: TrainingHistoryEntry[];
  validationResults: ValidationResult;
  errors: string[];
  completedAt: Date;
}

export interface TrainingHistoryEntry {
  epoch: number;
  trainLoss: number;
  trainAccuracy: number;
  valLoss: number;
  valAccuracy: number;
}

export interface ValidationResult {
  confusionMatrix: number[][];
  rocCurve: { fpr: number; tpr: number; threshold: number }[];
  precisionRecallCurve: { precision: number; recall: number; threshold: number }[];
  calibrationCurve: { predicted: number; actual: number }[];
}

export interface DriftDetectionResult {
  modelId: string;
  version: string;
  psiScore: number;
  driftDetected: boolean;
  featureDrift: Record<string, number>;
  populationDate: Date;
  referenceDate: Date;
}

export interface ModelConfig {
  modelId: string;
  modelType: ModelType;
  status: ModelStatus;
  weightsPath?: string;
  metadata: ModelMetadata;
  performance?: ModelPerformance;
}
