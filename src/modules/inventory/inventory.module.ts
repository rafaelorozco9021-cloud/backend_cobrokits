import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { AutoCloseService } from '../auto-close/auto-close.service';

@Module({
  controllers: [InventoryController],
  providers: [AutoCloseService],
  exports: [AutoCloseService],
})
export class InventoryModule {}
