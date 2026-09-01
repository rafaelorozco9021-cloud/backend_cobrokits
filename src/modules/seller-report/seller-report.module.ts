import { Module } from '@nestjs/common';
import { SellerReportController } from './seller-report.controller';

@Module({ controllers: [SellerReportController] })
export class SellerReportModule {}
