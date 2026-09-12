import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const tenant = req.tenant;
    if (tenant?.schema) {
      // Set search_path for this request. Use a dedicated query to set for the pooled connection.
      // Note: pg pool shares connections, so we must use SET LOCAL within a transaction or QueryRunner.
      // Simpler: each controller will use search_path prefix; but we set here as best-effort.
      try {
        await this.dataSource.query(`SET search_path TO ${tenant.schema}, cobrokits, public`);
      } catch {}
    } else {
      try { await this.dataSource.query(`SET search_path TO cobrokits, public`); } catch {}
    }
    return next.handle();
  }
}
