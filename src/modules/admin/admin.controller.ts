import { Controller, Get, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { DataSource } from 'typeorm';

function isSuperAdmin(req: any): boolean {
  return req.user?.role === 'superadmin' || req.headers['x-user-role'] === 'superadmin';
}

@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService, private dataSource: DataSource) {}

  @Get('overview')
  async overview(@Req() req: any) {
    if (!isSuperAdmin(req)) return { error: 'No autorizado: superadmin requerido', status: 403 };
    return this.adminService.overview();
  }

  @Get('tenants')
  async tenants(@Req() req: any) {
    if (!isSuperAdmin(req)) return { error: 'No autorizado', status: 403 };
    return this.adminService.tenants();
  }

  @Delete('tenants')
  async deleteTenant(@Query('id') id: string, @Req() req: any) {
    if (!isSuperAdmin(req)) return { error: 'No autorizado', status: 403 };
    if (!id) return { error: 'id requerido' };
    return this.adminService.deleteTenant(id);
  }

  @Get('health')
  async health(@Req() req: any) {
    // Public-like but shows superadmin check
    return { superadmin: isSuperAdmin(req), user: req.user || null };
  }
}
