import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verify } from 'jsonwebtoken';
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

    const request = context.switchToHttp().getRequest();

    const cookieToken = request.cookies?.token;
    const authHeader: string | undefined = request.headers?.authorization;
    let token: string | null = null;

    if (cookieToken) token = cookieToken;
    else if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);

    if (!token) throw new UnauthorizedException('No token provided');

    try {
      const secret = process.env.JWT_SECRET || 'cobrokits-jwt-secret-change-in-production';
      const payload: any = verify(token, secret);
      request.user = payload;
      request.headers['x-user-id'] = payload.userId;
      request.headers['x-user-role'] = payload.role;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
