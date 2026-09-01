import { Controller, Get, Post, Patch, Delete, Query, Body } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('api/cobros')
export class CobrosController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list(@Query('sellerId') sellerId?: string) {
    try {
      if (sellerId) {
        return this.dataSource.query('SELECT * FROM payments WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100', [sellerId]);
      }
      return this.dataSource.query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 100');
    } catch (e) {
      return { stub: true, module: 'cobros', table: 'payments', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any) {
    return { stub: true, module: 'cobros', received: body, message: 'POST stub - implementar logica de negocio' };
  }

  @Patch()
  async update(@Body() body: any) {
    return { stub: true, module: 'cobros', received: body, message: 'PATCH stub' };
  }

  @Delete()
  async remove(@Query('id') id: string) {
    try {
      if (id) await this.dataSource.query('DELETE FROM payments WHERE id = $1', [id]);
      return { success: true, id };
    } catch (e) {
      return { stub: true, error: (e as Error).message };
    }
  }
}
