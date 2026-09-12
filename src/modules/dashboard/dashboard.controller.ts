import { Controller, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { Request } from 'express';
import { getRequestTokens, verifyToken } from '../../common/helpers/auth-tokens.helper';
import { TenantService } from '../tenant/tenant.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private tenantService: TenantService,
  ) {}

  @Get()
  async get(@Query('action') action: string = 'overview', @Req() req: Request) {
    // Probar todos los tokens (cookie duplicada vieja + nueva, Bearer)
    const tokens = getRequestTokens(req);
    if (!tokens.length) throw new UnauthorizedException('No autenticado');

    let payload: any = null;
    for (const t of tokens) {
      payload = verifyToken(t);
      if (payload) break;
    }
    if (!payload) throw new UnauthorizedException('Token inválido');

    const sellerId = payload.userId;
    const tenant = (req as any).tenant;
    const schema = tenant?.schema || this.tenantService.getSchemaFromRequest(req);

    if (action === 'overview') return this.dashboardService.overview(sellerId, schema);
    if (action === 'sellers') return this.dashboardService.sellers(schema);

    return { error: 'Acción no válida' };
  }
}
