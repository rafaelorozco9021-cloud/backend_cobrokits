import { Module } from '@nestjs/common';
import { MonthlyReportController } from './monthly-report.controller';

@Module({ controllers: [MonthlyReportController] })
export class MonthlyReportModule {}
