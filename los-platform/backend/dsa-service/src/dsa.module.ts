import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, MetricsModule } from '@los/common';
import { DSAController } from './controllers/dsa.controller';
import { MetricsController } from './controllers/metrics.controller';
import { HealthController } from './controllers/health.controller';
import { DSAService } from './services/dsa.service';
import {
  DSAPartner,
  DSAOfficer,
  DSAApplication,
  DSACommission,
} from './entities/dsa.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'los_dsa',
      entities: [DSAPartner, DSAOfficer, DSAApplication, DSACommission],
      synchronize: false,
      logging: ['error', 'warn'],
    }),
    TypeOrmModule.forFeature([DSAPartner, DSAOfficer, DSAApplication, DSACommission]),
    KafkaModule,
    MetricsModule,
  ],
  controllers: [DSAController, MetricsController, HealthController],
  providers: [DSAService],
  exports: [DSAService],
})
export class DSAModule {}
