import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Guard de superadmin: usa SOLO req.user (JWT ya verificado por JwtAuthGuard),
 * nunca headers manipulables desde el cliente.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || user.role !== 'superadmin') {
      throw new ForbiddenException('No autorizado: superadmin requerido');
    }
    return true;
  }
}