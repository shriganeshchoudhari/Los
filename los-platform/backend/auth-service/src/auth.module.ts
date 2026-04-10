import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MetricsModule } from '@los/common';
import { AuthController } from './controllers/auth.controller';
import { HealthController } from './controllers/health.controller';
import { JwksController } from './controllers/jwks.controller';
import { MetricsController } from './controllers/metrics.controller';
import { AuthService } from './services/auth.service';
import { LdapService } from './services/ldap.service';
import { User, OtpSession, RefreshToken } from './entities';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    MetricsModule,
    TypeOrmModule.forFeature([User, OtpSession, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, HealthController, JwksController, MetricsController],
  providers: [AuthService, LdapService, JwtStrategy],
  exports: [AuthService, LdapService, JwtModule],
})
export class AuthModule {}
