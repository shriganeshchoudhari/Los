import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipAuth } from '@los/common';
import { JwtKeyManager } from '../utils/jwt-key-manager';

@ApiTags('JWKS')
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keyManager: JwtKeyManager) {}

  @Get('jwks.json')
  @SkipAuth()
  @ApiOperation({ summary: 'JWKS endpoint for Kong/API Gateway JWT validation' })
  @ApiResponse({ status: 200, description: 'JSON Web Key Set' })
  getJwks() {
    return this.keyManager.toJWKS();
  }
}
