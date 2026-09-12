import { Controller, Get, Post, Patch, Delete, Query, Body, Res, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import type { Response, Request } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
    const host = (req.headers.host || '').toLowerCase();
    const isProduction = host.includes('cobrokits.online');
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain: isProduction ? '.cobrokits.online' : undefined,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return result;
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

