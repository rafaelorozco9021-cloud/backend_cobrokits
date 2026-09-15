import { verify } from 'jsonwebtoken';
import { getJwtSecret } from './jwt-secret.helper';

const JWT_SECRET = getJwtSecret();

/**
 * Extrae TODOS los valores de la cookie `token` del header crudo.
 * Los navegadores pueden enviar duplicadas (ej: host-only vieja pre-wipe +
 * dominio nueva). cookie-parser se queda con una sola; aquí las probamos todas.
 */
export function getRequestTokens(req: any): string[] {
  const out: string[] = [];
  const raw: string = (req.headers?.cookie as string) || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() !== 'token') continue;
    let v = part.slice(idx + 1).trim();
    if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    try {
      v = decodeURIComponent(v);
    } catch {}
    if (v) out.push(v);
  }
  const h: string | undefined = req.headers?.authorization;
  if (h?.startsWith('Bearer ')) {
    const b = h.substring(7).trim();
    if (b) out.push(b);
  }
  return [...new Set(out)];
}

export function verifyToken(token: string): any | null {
  try {
    return verify(token, JWT_SECRET) as any;
  } catch {
    return null;
  }
}
