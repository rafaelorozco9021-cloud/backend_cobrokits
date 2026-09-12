import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantService } from './tenant.service';

@Controller('api/tenants')
export class TenantController {
  constructor(private dataSource: DataSource, private tenantService: TenantService) {}

  @Get()
  async list() {
    return this.tenantService.listTenants();
  }

  @Get('me')
  async me(@Req() req: any) {
    return req.tenant || null;
  }

  @Post('provision')
  async provision(@Body() body: any) {
    // Manual provision for new empresa
    const empresaId = body.empresaId || body.id;
    const name = body.name || 'Empresa';
    if (!empresaId) return { success: false, error: 'empresaId requerido' };
    const { execSync } = require('child_process');
    try {
      execSync(`node scripts/provision-tenant-v2.js ${empresaId}`, { stdio: 'inherit' });
    } catch {}
    return { success: true, empresaId, schema: this.tenantService.schemaForEmpresa(empresaId) };
  }
}
