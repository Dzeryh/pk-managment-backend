import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../common/decorators/public.decorator.js';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  database: 'up';
  timestamp: string;
  uptimeSeconds: number;
}

/**
 * Sonde publique `/api/health`.
 *
 * Elle vérifie réellement la base (`SELECT 1`) : un conteneur qui répondrait
 * « ok » avec une base injoignable ferait passer une panne pour un succès.
 */
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Service temporairement indisponible.');
    }

    return {
      status: 'ok',
      service: 'pk-managment-backend',
      version: '0.1.0',
      database: 'up',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
