import { Module, MiddlewareConsumer, NestModule, ModuleRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoanModule } from './src/loan.module';
import { RedisModule, REDIS_CLIENT, IdempotencyMiddleware, AuditModule } from '@los/common';
import { Redis } from 'ioredis';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    AuditModule,
    LoanModule,
  ],
})
export class AppModule implements NestModule {
  constructor(private readonly moduleRef: ModuleRef) {}

  configure(consumer: MiddlewareConsumer) {
    const redis = this.moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });

    consumer
      .apply(
        new IdempotencyMiddleware({
          redisClient: redis,
          ttlSeconds: 86400,
          headerName: 'X-Idempotency-Key',
        }),
      )
      .exclude('/health', '/healthz', '/ready')
      .forRoutes('*');
  }
}
