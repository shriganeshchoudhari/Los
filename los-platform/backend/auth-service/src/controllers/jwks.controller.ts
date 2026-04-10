import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipAuth } from '@los/common';
import { JwtKeyManager } from '../utils/jwt-key-manager';
import { ConfigService } from '@nestjs/config';

@ApiTags('JWKS')
@Controller('.well-known')
export class JwksController {
  private readonly keyManager: JwtKeyManager;

  constructor(private readonly configService: ConfigService) {
    const privateKeyPem = this.configService.get<string>('JWT_PRIVATE_KEY');
    this.keyManager = new JwtKeyManager(privateKeyPem);
  }

  @Get('jwks.json')
  @SkipAuth()
  @ApiOperation({ summary: 'JWKS endpoint for Kong/API Gateway JWT validation' })
  @ApiResponse({ status: 200, description: 'JSON Web Key Set' })
  getJwks() {
    return this.keyManager.toJWKS();
  }
}
