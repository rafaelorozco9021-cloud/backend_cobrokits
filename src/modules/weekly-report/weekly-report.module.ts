import { Module } from '@nestjs/common';
import { WeeklyReportController } from './weekly-report.controller';

@Module({ controllers: [WeeklyReportController] })
export class WeeklyReportModule {}
