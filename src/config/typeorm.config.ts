import 'dotenv/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function getTypeOrmConfig(): TypeOrmModuleOptions {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  return {
    type: 'postgres',
    url,
    ssl: { rejectUnauthorized: false },
    schema: 'cobrokits',
    // timezone handled by postgres session
    extra: {
      options: '-c search_path=cobrokits,public -c timezone=America/Bogota',
    },
    autoLoadEntities: true,
    synchronize: false, // SQL schema is source of truth (cobrokits_postgres.sql)
    logging: false,
  };
}
