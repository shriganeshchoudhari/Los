import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipAuth } from '@los/common';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @SkipAuth()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'dsa-service',
    };
  }

  @Get('healthz')
  @SkipAuth()
  healthz() {
    return { status: 'ok' };
  }

  @Get('ready')
  @SkipAuth()
  ready() {
    return { status: 'ready' };
  }
}
