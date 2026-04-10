import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, MetricsModule } from '@los/common';
import { NotificationController, TemplateController, PreferenceController } from './controllers/notification.controller';
import { HealthController } from './controllers/health.controller';
import { MetricsController } from './controllers/metrics.controller';
import { NotificationService } from './services/notification.service';
import {
  TemplateEngine,
  SMSProvider,
  EmailProvider,
  WhatsAppProvider,
  PushProvider,
} from './providers/notification-providers';
import {
  Notification,
  NotificationTemplate,
  NotificationPreference,
  NotificationOptOut,
  NotificationDeliveryLog,
} from './entities/notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'los_notification',
      entities: [Notification, NotificationTemplate, NotificationPreference, NotificationOptOut, NotificationDeliveryLog],
      synchronize: false,
      logging: ['error', 'warn'],
    }),
    TypeOrmModule.forFeature([
      Notification,
      NotificationTemplate,
      NotificationPreference,
      NotificationOptOut,
      NotificationDeliveryLog,
    ]),
    KafkaModule,
    MetricsModule,
  ],
  controllers: [NotificationController, TemplateController, PreferenceController, HealthController, MetricsController],
  providers: [
    NotificationService,
    TemplateEngine,
    SMSProvider,
    EmailProvider,
    WhatsAppProvider,
    PushProvider,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
