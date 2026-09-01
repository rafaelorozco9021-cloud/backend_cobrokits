import { Module } from '@nestjs/common';
import { CollectionReportController } from './collection-report.controller';

@Module({ controllers: [CollectionReportController] })
export class CollectionReportModule {}
