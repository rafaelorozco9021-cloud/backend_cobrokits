import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { assertSafeIdent } from '../../common/helpers/sql-ident.helper';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const tenant = req.tenant;
    if (tenant?.schema) {
      // Set search_path for this request. El schema viene del registro de tenants
      // (no del input del cliente), pero validamos el identificador antes de interpolar.
      try {
        await this.dataSource.query(`SET search_path TO ${assertSafeIdent(tenant.schema)}, cobrokits, public`);
      } catch {}
    } else {
      try { await this.dataSource.query(`SET search_path TO cobrokits, public`); } catch {}
    }
    return next.handle();
  }
}
