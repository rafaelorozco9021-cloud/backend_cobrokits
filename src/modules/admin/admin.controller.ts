import { Controller, Get, Delete, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from './superadmin.guard';
import { DataSource } from 'typeorm';

@UseGuards(SuperAdminGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private adminService: AdminService, private dataSource: DataSource) {}

  @Get('overview')
  async overview() {
    return this.adminService.overview();
  }

  @Get('tenants')
  async tenants() {
    return this.adminService.tenants();
  }

  @Delete('tenants')
  async deleteTenant(@Query('id') id: string) {
    if (!id) return { error: 'id requerido' };
    return this.adminService.deleteTenant(id);
  }

  @Get('health')
  async health(@Req() req: any) {
    return { superadmin: req.user?.role === 'superadmin', user: req.user?.id || null };
  }
}