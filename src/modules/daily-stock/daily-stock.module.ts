import { Module } from '@nestjs/common';
import { DailyStockController } from './daily-stock.controller';

@Module({ controllers: [DailyStockController] })
export class DailyStockModule {}
