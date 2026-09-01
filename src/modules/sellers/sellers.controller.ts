import { Controller, Get, Post, Patch, Delete, Body, Query } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('api/sellers')
export class SellersController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list() {
    return this.dataSource.query('SELECT id, name, email, phone, status FROM sellers ORDER BY name');
  }

  @Post()
  async create(@Body() body: any) {
    const rows: any[] = await this.dataSource.query(
      `INSERT INTO sellers (name, email, phone, status) VALUES ($1, $2, $3, 'active') RETURNING id, name, email, phone, status`,
      [body.name, body.email, body.phone || ''],
    );
    return rows[0];
  }

  @Patch()
  async update(@Body() body: any) {
    await this.dataSource.query(
      `UPDATE sellers SET name = $1, email = $2, phone = $3, updated_at = NOW() WHERE id = $4`,
      [body.name, body.email, body.phone, body.id],
    );
    return { id: body.id, ...body };
  }

  @Delete()
  async remove(@Query('id') id: string) {
    await this.dataSource.query('DELETE FROM sellers WHERE id = $1', [id]);
    return { success: true };
  }
}
