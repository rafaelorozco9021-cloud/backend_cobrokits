import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';

function buildOriginMatcher(allowedOrigins: string[]) {
  const regexes = allowedOrigins.map((pat) => {
    if (!pat.includes('*')) return null;
    return new RegExp('^' + pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  });
  return (origin: string): boolean => {
    if (allowedOrigins.includes(origin)) return true;
    for (const re of regexes) {
      if (re && re.test(origin)) return true;
    }
    // Multitenancia por subdominio propio (apex + *.cobrokits.online). NO .vercel.app.
    try {
      const host = new URL(origin).hostname.toLowerCase();
      return host === 'cobrokits.online' || host.endsWith('.cobrokits.online');
    } catch {
      return false;
    }
  };
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Protección CSRF de doble capa:
 * 1) Doble envío: si existe cookie `csrf_token`, el header X-CSRF-Token debe coincidir.
 * 2) Validación de Origin: si el navegador manda Origin, debe estar en la allowlist
 *    (los POST cross-site de navegador no pasan; los clientes sin Origin, no).
 * Combinado con cookies SameSite=Lax cubre el vector CSRF en navegador.
 */
function csrfProtection(isAllowedOrigin: (origin: string) => boolean) {
  return (req: any, res: express.Response, next: express.NextFunction) => {
    if (!MUTATING_METHODS.has(req.method)) return next();
    const csrfCookie = req.cookies?.['csrf_token'];
    const csrfHeader = req.headers['x-csrf-token'];
    if (csrfCookie && csrfHeader === csrfCookie) return next();
    const origin = (req.headers.origin as string) || (req.headers['sec-fetch-site'] === 'same-origin' ? 'same-origin' : null);
    if (!origin) return next();
    if (origin === 'same-origin' || isAllowedOrigin(origin)) return next();
    return res.status(403).json({ message: 'CSRF: origen no permitido' });
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Detrás de Vercel/Render: confiar en los proxies para que req.ip sea la IP real
  // del cliente (X-Forwarded-For lo reescribe el proxy, no el cliente).
  app.set('trust proxy', true);

  app.use(cookieParser());
  app.use(helmet());
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedOrigins = corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  const isAllowedOrigin = buildOriginMatcher(allowedOrigins);

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Tenant-Id', 'X-Tenant-Slug', 'X-Tenant-Host', 'X-Empresa-Id'],
  });

  app.use(csrfProtection(isAllowedOrigin));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port);
  console.log(`✅ backendkit listening on http://localhost:${port}`);
  console.log(`   CORS origin: ${corsOrigin}`);
  console.log(`   Modo: ${process.env.NODE_ENV === 'production' || process.env.RENDER ? 'production' : 'development'}`);
}
bootstrap();