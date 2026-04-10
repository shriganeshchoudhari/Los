import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MLTrainingService } from '../ml-training.service';
import { MLInferenceService } from '../ml-inference.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MLModelRegistry, MLPredictionLog } from '../entities/ml-model.entity';
import { RolesGuard, Roles } from '@los/common';
import { TrainingConfig, ModelType, LoanSegment } from '../ml.types';

@ApiTags('ML Models')
@Controller('ml')
export class MLController {
  constructor(
    private readonly trainingService: MLTrainingService,
    private readonly inferenceService: MLInferenceService,
    @InjectRepository(MLModelRegistry)
    private readonly modelRepo: Repository<MLModelRegistry>,
    @InjectRepository(MLPredictionLog)
    private readonly logRepo: Repository<MLPredictionLog>,
  ) {}

  @Get('models')
  @ApiOperation({ summary: 'List all registered ML models' })
  @ApiResponse({ status: 200, description: 'List of ML models' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by model status (TRAINING/TRAINED/ACTIVE/DEPRECATED)' })
  @ApiQuery({ name: 'segment', required: false, description: 'Filter by loan segment (RETAIL/MSME/AGRI)' })
  async listModels(
    @Query('status') status?: string,
    @Query('segment') segment?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (segment) where.loanSegment = segment;
    const models = await this.modelRepo.find({
      where,
      order: { version: 'DESC', createdAt: 'DESC' },
      select: [
        'modelId', 'version', 'modelName', 'modelType', 'status',
        'loanSegment', 'loanProducts', 'isActive', 'trainedAt',
        'trainingDatasetSize', 'performanceMetrics', 'productionSince',
      ],
    });
    return { models, total: models.length };
  }

  @Get('models/:modelId')
  @ApiOperation({ summary: 'Get model details' })
  @ApiResponse({ status: 200, description: 'Model details' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async getModel(@Param('modelId') modelId: string) {
    const model = await this.modelRepo.findOne({ where: { modelId } });
    if (!model) return { error: 'Model not found' };
    return model;
  }

  @Post('train')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Trigger ML model training' })
  @ApiResponse({ status: 202, description: 'Training job accepted and queued' })
  async trainModel(@Body() config: TrainingConfig) {
    const result = await this.trainingService.trainModel(config);
    return result;
  }

  @Post('models/:modelId/:version/activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Activate a trained model for production' })
  @ApiResponse({ status: 200, description: 'Model activated successfully' })
  async activateModel(
    @Param('modelId') modelId: string,
    @Param('version') version: string,
  ) {
    await this.trainingService.activateModel(modelId, version);
    return { message: 'Model activated', modelId, version };
  }

  @Get('models/:modelId/stats')
  @ApiOperation({ summary: 'Get model prediction statistics' })
  async getModelStats(@Param('modelId') modelId: string) {
    return this.inferenceService.getModelStats(modelId);
  }

  @Get('predictions/:applicationId')
  @ApiOperation({ summary: 'Get prediction history for an application' })
  async getPredictionHistory(@Param('applicationId') applicationId: string) {
    const predictions = await this.logRepo.find({
      where: { applicationId },
      order: { predictedAt: 'DESC' },
      take: 10,
    });
    return { predictions };
  }

  @Post('predictions/:applicationId/feedback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit actual outcome for model feedback' })
  async submitFeedback(
    @Param('applicationId') applicationId: string,
    @Body() feedback: { actualOutcome: 'DEFAULT' | 'REPAYING' | 'EARLY_SETTLED'; daysToDefault?: number },
  ) {
    const outcomeDate = new Date();
    if (feedback.daysToDefault) {
      outcomeDate.setDate(outcomeDate.getDate() - feedback.daysToDefault);
    }
    await this.logRepo.update(
      { applicationId },
      {
        actualOutcome: feedback.actualOutcome,
        daysToDefault: feedback.daysToDefault ?? null,
        outcomeDate,
      },
    );
    return { message: 'Feedback recorded' };
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear the model inference cache' })
  async clearCache() {
    this.inferenceService.clearCache();
    return { message: 'Cache cleared' };
  }
}
