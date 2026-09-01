import { Module } from '@nestjs/common';
import { CobrosController } from './cobros.controller';

@Module({ controllers: [CobrosController] })
export class CobrosModule {}
