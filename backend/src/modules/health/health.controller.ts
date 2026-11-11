import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Database } from '../../db/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Database) {}

  @Get()
  liveness(): { status: string; service: string; time: string } {
    return {
      status: 'ok',
      service: 'digio-api',
      time: new Date().toISOString(),
    };
  }

  @Get('ready')
  async readiness(): Promise<{
    status: string;
    database: { ok: boolean; latencyMs: number };
    postgis: string | null;
  }> {
    const startedAt = Date.now();
    const result = await this.db.execute<{ version: string | null }>(
      sql`select postgis_version() as version`,
    );

    return {
      status: 'ok',
      database: { ok: true, latencyMs: Date.now() - startedAt },
      postgis: result.rows[0]?.version ?? null,
    };
  }
}
