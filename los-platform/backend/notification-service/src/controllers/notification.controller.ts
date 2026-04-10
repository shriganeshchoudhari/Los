import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@los/common';
import { NotificationService } from '../services/notification.service';
import {
  SendNotificationDto,
  BulkNotificationDto,
  BulkNotificationResponseDto,
  NotificationResponseDto,
  NotificationQueryDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  UpdatePreferenceDto,
  OptOutDto,
  WebhookCallbackDto,
  OTPSendDto,
  OTPVerifyDto,
  NotificationStatsDto,
} from '../dto/notification.dto';
import { NotificationChannel, NotificationCategory } from '../entities/notification.entity';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send a single notification' })
  @ApiResponse({ status: 200, description: 'Notification sent', type: NotificationResponseDto })
  async send(@Body(ValidationPipe) dto: SendNotificationDto) {
    return this.notificationService.send(dto);
  }

  @Post('send/bulk')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Send bulk notifications' })
  @ApiResponse({ status: 200, description: 'Bulk notification results', type: BulkNotificationResponseDto })
  async sendBulk(@Body(ValidationPipe) dto: BulkNotificationDto) {
    return this.notificationService.sendBulk(dto);
  }

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP via SMS', description: 'OTP for login/consent/eSign/bureau_consent' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async sendOTP(@Body(ValidationPipe) dto: OTPSendDto) {
    const result = await this.notificationService.sendOTP(dto);
    return {
      success: result.success,
      messageId: result.messageId,
      expiresAt: result.expiresAt,
      maskedMobile: dto.mobileNumber.substring(0, 3) + 'XXXXX' + dto.mobileNumber.slice(-2),
    };
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP' })
  @ApiResponse({ status: 200, description: 'OTP verification result' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOTP(@Body(ValidationPipe) dto: OTPVerifyDto) {
    const result = await this.notificationService.verifyOTP(dto);
    return result;
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get notification history with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated notification history' })
  async getHistory(@Query(ValidationPipe) query: NotificationQueryDto) {
    const { notifications, total } = await this.notificationService.getNotificationHistory(query);
    const page = query.page || 1;
    const limit = query.limit || 20;
    return {
      notifications: notifications.map(n => ({
        id: n.id,
        applicationId: n.applicationId,
        channel: n.channel,
        category: n.category,
        status: n.status,
        recipientId: n.recipientId,
        templateName: n.templateName,
        subject: n.subject,
        renderedContent: n.renderedContent?.substring(0, 200),
        sentAt: n.sentAt,
        deliveredAt: n.deliveredAt,
        readAt: n.readAt,
        errorCode: n.errorCode,
        createdAt: n.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle provider delivery status webhook (no auth for external providers)' })
  async handleWebhook(@Body(ValidationPipe) dto: WebhookCallbackDto) {
    await this.notificationService.handleWebhook(dto);
    return { received: true };
  }

  @Post('opt-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Opt out from notifications' })
  async optOut(
    @Body(ValidationPipe) dto: OptOutDto,
    @Headers('x-forwarded-for') ip?: string,
  ) {
    await this.notificationService.optOut(dto.recipientId || '', dto, ip);
    return { success: true, message: `Successfully opted out from ${dto.channel} notifications` };
  }

  @Get('stats')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get notification delivery statistics' })
  @ApiResponse({ status: 200, description: 'Notification delivery statistics', type: NotificationStatsDto })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'toDate', required: false, description: 'End date (ISO format)' })
  async getStats(@Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string): Promise<NotificationStatsDto> {
    return this.notificationService.getStats(fromDate, toDate);
  }
}

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications/templates')
export class TemplateController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new notification template' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async createTemplate(@Body(ValidationPipe) dto: CreateTemplateDto) {
    return this.notificationService.createTemplate(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all notification templates' })
  @ApiResponse({ status: 200, description: 'List of notification templates' })
  @ApiQuery({ name: 'channel', required: false, enum: NotificationChannel })
  @ApiQuery({ name: 'category', required: false, enum: NotificationCategory })
  async getTemplates(
    @Query('channel') channel?: NotificationChannel,
    @Query('category') category?: NotificationCategory,
  ) {
    return this.notificationService.getTemplates(channel, category);
  }

  @Put(':templateName')
  @ApiOperation({ summary: 'Update a notification template' })
  async updateTemplate(
    @Param('templateName') templateName: string,
    @Body(ValidationPipe) dto: UpdateTemplateDto,
  ) {
    return this.notificationService.updateTemplate(templateName, dto);
  }

  @Delete(':templateName')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a notification template' })
  async deactivateTemplate(@Param('templateName') templateName: string) {
    await this.notificationService.updateTemplate(templateName, { isActive: false } as UpdateTemplateDto);
  }
}

@ApiTags('Preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications/preferences')
export class PreferenceController {
  constructor(private readonly notificationService: NotificationService) {}

  @Put()
  @ApiOperation({ summary: 'Update notification preferences for a user' })
  @ApiResponse({ status: 200, description: 'Preference updated' })
  async updatePreference(
    @Headers('x-user-id') userId: string,
    @Body(ValidationPipe) dto: UpdatePreferenceDto,
  ) {
    return this.notificationService.updatePreference(userId, dto);
  }
}
