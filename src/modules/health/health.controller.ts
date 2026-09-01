import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

@Controller('api/health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok', service: 'backendkit', timestamp: new Date().toISOString() };
  }
}
