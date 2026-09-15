import { Controller, Get, Post, Patch, Delete, Query, Body, Res, Req, Header, UnauthorizedException } from '@nestjs/common';
import crypto from 'crypto';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import type { Response, Request } from 'express';
import { getRequestTokens, verifyToken } from '../../common/helpers/auth-tokens.helper';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async me(@Req() req: Request) {
    // Probar todos los tokens (cookie duplicada vieja + nueva, Bearer).
    // El primero que verifique Y corresponda a un usuario existente gana.
    const tokens = getRequestTokens(req);
    if (!tokens.length) throw new UnauthorizedException('No autenticado');
    for (const t of tokens) {
      const payload = verifyToken(t);
      if (!payload?.userId) continue;
      try {
        return await this.authService.me(payload.userId);
      } catch {
        continue; // token válido pero usuario inexistente (stale): probar el siguiente
      }
    }
    throw new UnauthorizedException('Token inválido');
  }

  @Get()
  async get(@Query('action') action: string = 'list', @Query('sellerId') sellerId: string) {
    if (action === 'today') return this.authService.todayStats();
    if (action === 'week') return this.authService.weekStats(sellerId);
    if (action === 'lowStock') return this.authService.lowStock(sellerId || null);
    return this.authService.listSellers();
  }

  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const result = await this.authService.login(body.email, body.password);
    // El rewrite de Next.js proxea al backend: Host llega como backend-cobrokits.onrender.com.
    // Usar x-forwarded-host / x-tenant-host para detectar el dominio público real.
    const host = (req.headers.host || '').toLowerCase();
    const fwdHost = ((req.headers['x-forwarded-host'] as string) || '').split(',')[0].trim().toLowerCase();
    const tenantHost = ((req.headers['x-tenant-host'] as string) || '').toLowerCase();
    const effectiveHost = `${host} ${fwdHost} ${tenantHost}`;
    const isProduction = effectiveHost.includes('cobrokits.online');
    // Purgar cookie host-only vieja (tokens pre-wipe): document.cookie no puede
    // borrar HttpOnly, así que se hace aquí. Sin Domain => borra la del host actual.
    res.cookie('token', '', { httpOnly: true, path: '/', maxAge: 0 });
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain: isProduction ? '.cobrokits.online' : undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    const csrfToken = crypto.randomBytes(32).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain: isProduction ? '.cobrokits.online' : undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return result;
  }

  @Public()
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    // Borrar ambas variantes: host-only y de dominio (el frontend no puede, es HttpOnly)
    res.cookie('token', '', { httpOnly: true, path: '/', maxAge: 0 });
    res.cookie('token', '', { httpOnly: true, path: '/', domain: '.cobrokits.online', maxAge: 0 });
    res.cookie('csrf_token', '', { httpOnly: false, path: '/', maxAge: 0 });
    res.cookie('csrf_token', '', { httpOnly: false, path: '/', domain: '.cobrokits.online', maxAge: 0 });
    return { success: true };
  }

  @Public()
  @Post()
  async create(@Body() body: { name: string; email: string; phone?: string; action?: string; email2?: string; password?: string; role?: string }) {
    // Si viene con action=login legacy (desde src/api/auth POST), redirigir lÃ³gica
    if (body.action === 'login') {
      const result = await this.authService.login((body as any).email, (body as any).password);
      return result;
    }
    return this.authService.createSeller(body);
  }

  @Patch()
  async patch(@Body() body: any) {
    if (body.id && body.action === 'close-day') {
      return this.authService.closeDay(body.id, body.date);
    }
    return this.authService.updateSeller(body.id, body);
  }

  @Delete()
  async del(@Query('id') id: string) {
    if (id === 'visit') {
      await this.authService['dataSource'].query('DELETE FROM cobrokits.customer_visits WHERE id = $1', []);
      return { success: true, message: 'Visita eliminada y stock revertido' };
    }
    return { error: 'ID requerido' };
  }
}

