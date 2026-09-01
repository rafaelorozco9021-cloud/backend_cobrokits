import { Module } from '@nestjs/common';
import { GeneralStockController } from './general-stock.controller';

@Module({ controllers: [GeneralStockController] })
export class GeneralStockModule {}
