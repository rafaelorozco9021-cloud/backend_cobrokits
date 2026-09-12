import { Controller, Get, Query, Req, UnauthorizedException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import type { Request } from 'express';
import { verify } from 'jsonwebtoken';
import { TenantService } from '../tenant/tenant.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(
    private dashboardService: DashboardService,
    private tenantService: TenantService,
  ) {}

  @Get()
  async get(@Query('action') action: string = 'overview', @Req() req: Request) {
    const cookie = (req as any).cookies?.token;
    const authHeader = req.headers.authorization;
    let token: string | null = null;
    if (cookie) token = cookie;
    else if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
    if (!token) throw new UnauthorizedException('No autenticado');

    let payload: any;
    try {
      payload = verify(token, process.env.JWT_SECRET || 'cobrokits-jwt-secret');
    } catch {
      throw new UnauthorizedException('Token inválido');
    }

    const sellerId = payload.userId;
    const tenant = (req as any).tenant;
    const schema = tenant?.schema || this.tenantService.getSchemaFromRequest(req);

    if (action === 'overview') return this.dashboardService.overview(sellerId);
    if (action === 'sellers') return this.dashboardService.sellers(schema);

    return { error: 'Acción no válida' };
  }
}
