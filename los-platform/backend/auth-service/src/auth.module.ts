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
import { JwtKeyManager } from './utils/jwt-key-manager';

function jwtKeyManagerFactory(configService: ConfigService): JwtKeyManager {
  const privateKeyPem = configService.get<string>('JWT_PRIVATE_KEY');
  return new JwtKeyManager(privateKeyPem);
}

@Module({
  imports: [
    MetricsModule,
    TypeOrmModule.forFeature([User, OtpSession, RefreshToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const keyManager = jwtKeyManagerFactory(configService);
        return {
          publicKey: keyManager.getPublicKeyPem(),
          verifyOptions: { algorithms: ['RS256'] },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, HealthController, JwksController, MetricsController],
  providers: [
    AuthService,
    LdapService,
    JwtStrategy,
    {
      provide: JwtKeyManager,
      useFactory: jwtKeyManagerFactory,
      inject: [ConfigService],
    },
  ],
  exports: [AuthService, LdapService],
})
export class AuthModule {}
