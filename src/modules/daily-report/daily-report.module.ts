import { Module } from '@nestjs/common';
import { DailyReportController } from './daily-report.controller';

@Module({ controllers: [DailyReportController] })
export class DailyReportModule {}
