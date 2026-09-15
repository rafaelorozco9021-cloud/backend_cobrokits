const WEAK_SECRETS = new Set([
  'alfanumerico',
  'change-me-in-production',
  'cobrokits-jwt-secret-change-in-production',
  'secret',
  'changeme',
  '123456',
]);

const DEV_FALLBACK = 'cobrokits-dev-only-insecure-secret-do-not-use-in-prod';

/**
 * Secret de firma JWT centralizado.
 * - Producción (NODE_ENV=production o Render): exige JWT_SECRET fuerte (>=32 chars) o NO arranca.
 * - Desarrollo: si falta, usa un fallback fijo SOLO para dev y avisa por consola.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
  if (secret && secret.length >= 32 && !WEAK_SECRETS.has(secret)) {
    return secret;
  }
  if (isProduction) {
    throw new Error(
      '[security] JWT_SECRET ausente, demasiado corto (<32 chars) o conocido-débil. ' +
        'Genera uno con `openssl rand -base64 48` y defínelo en el entorno de producción.',
    );
  }
  console.warn('[security] JWT_SECRET ausente o débil; usando fallback SOLO para desarrollo.');
  return DEV_FALLBACK;
}