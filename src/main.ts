import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedOrigins = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // Exact match
      if (allowedOrigins.includes(origin)) return cb(null, true);
      // Wildcard patterns like https://*.cobrokits.online
      for (const pat of allowedOrigins) {
        if (pat.includes('*')) {
          const regex = new RegExp('^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
          if (regex.test(origin)) return cb(null, true);
        }
      }
      // Auto-allow any subdomain of cobrokits.online for wildcard multitenancy
      try {
        const u = new URL(origin);
        const host = u.hostname.toLowerCase();
        if (host === 'cobrokits.online' || host.endsWith('.cobrokits.online') || host.endsWith('.vercel.app')) {
          return cb(null, true);
        }
      } catch {}
      return cb(null, false);
    },
    credentials: true,
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port);
  console.log(`✅ backendkit listening on http://localhost:${port}`);
  console.log(`   CORS origin: ${corsOrigin}`);
}
bootstrap();
