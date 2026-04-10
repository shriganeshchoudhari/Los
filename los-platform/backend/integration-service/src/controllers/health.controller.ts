import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CibilClient, ExperianClient, EquifaxClient, CrifClient } from '../clients/bureau-clients';
import { CBSClient } from '../clients/cbs-client';
import { IMPSClient, NEFTClient, RTGSClient, UPIClient, NACHClient } from '../clients/npci-clients';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly cibilClient: CibilClient,
    private readonly experianClient: ExperianClient,
    private readonly equifaxClient: EquifaxClient,
    private readonly crifClient: CrifClient,
    private readonly cbsClient: CBSClient,
    private readonly impsClient: IMPSClient,
    private readonly neftClient: NEFTClient,
    private readonly rtgsClient: RTGSClient,
    private readonly upiClient: UPIClient,
    private readonly nachClient: NACHClient,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  ping() {
    return { status: 'ok', service: 'integration-service', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe with integration health' })
  readiness() {
    const metrics = {
      cibil: this.cibilClient.getCircuitMetrics(),
      experian: this.experianClient.getCircuitMetrics(),
      equifax: this.equifaxClient.getCircuitMetrics(),
      crif: this.crifClient.getCircuitMetrics(),
      cbs: this.cbsClient.getCircuitMetrics(),
      imps: this.impsClient.getCircuitMetrics(),
      neft: this.neftClient.getCircuitMetrics(),
      rtgs: this.rtgsClient.getCircuitMetrics(),
      upi: this.upiClient.getCircuitMetrics(),
      nach: this.nachClient.getCircuitMetrics(),
    };

    const openCircuits = Object.entries(metrics)
      .filter(([, m]) => m.state === 'OPEN')
      .map(([name]) => name);

    return {
      status: openCircuits.length === 0 ? 'ready' : 'degraded',
      service: 'integration-service',
      timestamp: new Date().toISOString(),
      circuits: metrics,
      openCircuits,
    };
  }
}
