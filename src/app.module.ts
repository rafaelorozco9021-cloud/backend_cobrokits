import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { getTypeOrmConfig } from './config/typeorm.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './modules/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SellersModule } from './modules/sellers/sellers.module';
import { CobrosModule } from './modules/cobros/cobros.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProductsModule } from './modules/products/products.module';
import { VisitsModule } from './modules/visits/visits.module';
import { StockModule } from './modules/stock/stock.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { DailyStockModule } from './modules/daily-stock/daily-stock.module';
import { GeneralStockModule } from './modules/general-stock/general-stock.module';
import { CollectionReportModule } from './modules/collection-report/collection-report.module';
import { DailyReportModule } from './modules/daily-report/daily-report.module';
import { WeeklyReportModule } from './modules/weekly-report/weekly-report.module';
import { MonthlyReportModule } from './modules/monthly-report/monthly-report.module';
import { SellerReportModule } from './modules/seller-report/seller-report.module';
import {
  Seller,
  Product,
  Customer,
  Payment,
  DailySellerStock,
  SellerInventory,
  WarehouseStock,
  CustomerVisit,
  CustomerVisitItem,
  CobroSeller,
  InventoryMovement,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...getTypeOrmConfig(),
      entities: [
        Seller,
        Product,
        Customer,
        Payment,
        DailySellerStock,
        SellerInventory,
        WarehouseStock,
        CustomerVisit,
        CustomerVisitItem,
        CobroSeller,
        InventoryMovement,
      ],
    }),
    AuthModule,
    DashboardModule,
    SellersModule,
    CobrosModule,
    CustomersModule,
    ProductsModule,
    VisitsModule,
    StockModule,
    InventoryModule,
    DailyStockModule,
    GeneralStockModule,
    CollectionReportModule,
    DailyReportModule,
    WeeklyReportModule,
    MonthlyReportModule,
    SellerReportModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
