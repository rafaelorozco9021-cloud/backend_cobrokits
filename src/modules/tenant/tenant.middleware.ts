import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: any, res: Response, next: NextFunction) {
    // Resolve tenant from header, JWT, or userId
    // 1) explicit header X-Tenant-Id
    let empresaId: string | null = (req.headers['x-tenant-id'] as string) || (req.headers['x-empresa-id'] as string) || null;
    // 2) from JWT payload if already decoded (JwtAuthGuard runs after middleware, so we try to decode without verify)
    if (!empresaId && req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '');
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        if (payload?.userId) {
          empresaId = payload.userId; // will be resolved to empresa via TenantService
        }
      } catch {}
    }
    // 3) from x-user-id header set by guard on previous request (fallback)
    if (!empresaId) empresaId = (req.headers['x-user-id'] as string) || null;

    if (empresaId) {
      // If empresaId is actually a sellerId, resolve to empresa
      const tenant = await this.tenantService.resolveByUserId(empresaId) || await this.tenantService.resolveByEmpresaId(empresaId);
      if (tenant) {
        req.tenant = tenant;
        // Set search_path for this request's pool connection via query
        // We use a lightweight SET that will be executed per request via interceptor
        // Store in req for downstream QueryRunner
      }
    }
    next();
  }
}
