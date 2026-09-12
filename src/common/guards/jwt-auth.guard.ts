import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRequestTokens, verifyToken } from '../helpers/auth-tokens.helper';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request: any = context.switchToHttp().getRequest();
    // Tenant ya resuelto por TenantMiddleware (req.tenant) - propagation para helpers legacy
    if (request.tenant?.empresaId) {
      request.headers['x-tenant-id'] = request.tenant.empresaId;
      request.headers['x-tenant-schema'] = request.tenant.schema;
    }

    const tokens = getRequestTokens(request);
    if (!tokens.length) throw new UnauthorizedException('No token provided');

    let payload: any = null;
    for (const t of tokens) {
      payload = verifyToken(t);
      if (payload) break;
    }
    if (!payload) throw new UnauthorizedException('Invalid token');
    request.user = payload;
    request.headers['x-user-id'] = payload.userId;
    request.headers['x-user-role'] = payload.role;
    return true;
  }
}
