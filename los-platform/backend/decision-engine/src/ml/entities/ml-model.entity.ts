import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum StoredModelStatus {
  TRAINING = 'TRAINING',
  VALIDATED = 'VALIDATED',
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  FAILED = 'FAILED',
}

export enum StoredModelType {
  LOGISTIC_REGRESSION = 'LOGISTIC_REGRESSION',
  RANDOM_FOREST = 'RANDOM_FOREST',
  GRADIENT_BOOSTING = 'GRADIENT_BOOSTING',
  NEURAL_NETWORK = 'NEURAL_NETWORK',
  ENSEMBLE = 'ENSEMBLE',
}

@Entity('ml_model_registry')
@Index(['modelId'], { unique: true })
@Index(['status', 'loanSegment'])
@Index(['isActive', 'loanSegment'])
export class MLModelRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'model_id', type: 'varchar', length: 50, unique: true })
  modelId: string;

  @Column({ name: 'version', type: 'varchar', length: 20 })
  version: string;

  @Column({ name: 'model_name', type: 'varchar', length: 100 })
  modelName: string;

  @Column({ type: 'enum', enum: StoredModelType, name: 'model_type' })
  modelType: StoredModelType;

  @Column({ type: 'enum', enum: StoredModelStatus, name: 'status' })
  status: StoredModelStatus;

  @Column({ name: 'loan_segment', type: 'varchar', length: 30, default: 'ALL' })
  loanSegment: string;

  @Column({ name: 'loan_products', type: 'jsonb', nullable: true })
  loanProducts: string[];

  @Column({ name: 'weights_path', type: 'varchar', length: 500, nullable: true })
  weightsPath: string;

  @Column({ name: 'weights_data', type: 'bytea', nullable: true })
  weightsData: Buffer;

  @Column({ name: 'feature_names', type: 'jsonb' })
  featureNames: string[];

  @Column({ name: 'scaler_mean', type: 'jsonb', nullable: true })
  scalerMean: number[];

  @Column({ name: 'scaler_std', type: 'jsonb', nullable: true })
  scalerStd: number[];

  @Column({ name: 'class_thresholds', type: 'jsonb', nullable: true })
  classThresholds: Record<string, number>;

  @Column({ name: 'coefficients', type: 'jsonb', nullable: true })
  coefficients: number[][];

  @Column({ name: 'intercepts', type: 'jsonb', nullable: true })
  intercepts: number[];

  @Column({ name: 'feature_importances', type: 'jsonb', nullable: true })
  featureImportances: Record<string, number>;

  @Column({ type: 'jsonb', name: 'performance_metrics', nullable: true })
  performanceMetrics: {
    gini?: number;
    ks?: number;
    auc?: number;
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1?: number;
    defaultThreshold?: number;
  };

  @Column({ name: 'training_dataset_size', type: 'int', nullable: true })
  trainingDatasetSize: number;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive: boolean;

  @Column({ name: 'trained_by', type: 'varchar', length: 100, nullable: true })
  trainedBy: string;

  @Column({ name: 'trained_at', type: 'timestamp with time zone', nullable: true })
  trainedAt: Date;

  @Column({ name: 'validation_date', type: 'timestamp with time zone', nullable: true })
  validationDate: Date;

  @Column({ name: 'training_history', type: 'jsonb', nullable: true })
  trainingHistory: any[];

  @Column({ name: 'production_since', type: 'timestamp with time zone', nullable: true })
  productionSince: Date;

  @Column({ name: 'replaced_by', type: 'varchar', length: 50, nullable: true })
  replacedBy: string;

  @Column({ name: 'replaced_at', type: 'timestamp with time zone', nullable: true })
  replacedAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;
}

@Entity('ml_prediction_log')
@Index(['modelId', 'applicationId'])
@Index(['predictedAt'])
export class MLPredictionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'application_id', type: 'uuid' })
  applicationId: string;

  @Column({ name: 'model_id', type: 'varchar', length: 50 })
  modelId: string;

  @Column({ name: 'model_version', type: 'varchar', length: 20 })
  modelVersion: string;

  @Column({ name: 'probability_of_default', type: 'numeric', precision: 6, scale: 5 })
  probabilityOfDefault: number;

  @Column({ name: 'score', type: 'int' })
  score: number;

  @Column({ name: 'grade', type: 'varchar', length: 5 })
  grade: string;

  @Column({ name: 'risk_level', type: 'varchar', length: 20 })
  riskLevel: string;

  @Column({ name: 'recommended_action', type: 'varchar', length: 30 })
  recommendedAction: string;

  @Column({ name: 'input_features', type: 'jsonb' })
  inputFeatures: Record<string, number>;

  @Column({ name: 'inference_time_ms', type: 'int' })
  inferenceTimeMs: number;

  @Column({ name: 'actual_outcome', type: 'varchar', length: 20, nullable: true })
  actualOutcome: string;

  @Column({ name: 'days_to_default', type: 'int', nullable: true })
  daysToDefault: number;

  @Column({ name: 'predicted_at', type: 'timestamp with time zone' })
  predictedAt: Date;

  @Column({ name: 'outcome_date', type: 'timestamp with time zone', nullable: true })
  outcomeDate: Date;
}
