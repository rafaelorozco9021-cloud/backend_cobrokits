import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  private extractSlugFromHost(host?: string): string | null {
    if (!host) return null;
    const h = host.split(':')[0].toLowerCase();
    if (h === 'cobrokits.online' || h === 'www.cobrokits.online' || h.endsWith('.vercel.app') || h === 'localhost' || h === '127.0.0.1') return null;
    if (h.endsWith('.cobrokits.online')) {
      const sub = h.replace('.cobrokits.online', '').trim();
      if (sub && sub !== 'www' && !sub.includes('.')) return sub;
    }
    return null;
  }

  async use(req: any, res: Response, next: NextFunction) {
    // 0) Subdomain slug: X-Tenant-Slug header or Host header (wildcard *.cobrokits.online)
    const slug = (req.headers['x-tenant-slug'] as string) || this.extractSlugFromHost(req.headers.host as string) || this.extractSlugFromHost(req.headers['x-tenant-host'] as string);
    if (slug) {
      const bySlug = await this.tenantService.resolveBySlug(slug);
      if (bySlug) {
        req.tenant = bySlug;
        req.headers['x-tenant-id'] = bySlug.empresaId;
        req.headers['x-tenant-schema'] = bySlug.schema;
        return next();
      }
    }
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
