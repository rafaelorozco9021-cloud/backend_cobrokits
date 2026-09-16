import { DataSource } from 'typeorm';

export async function getEmpresaIdForUser(dataSource: DataSource, userId: string): Promise<string | null> {
  if (!userId || userId === 'admin') return null; // null = sin filtro (admin global)
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  try {
    const rows: any[] = await dataSource.query(
      `SELECT id, role, empresa_id FROM cobrokits.sellers WHERE id = $1`,
      [userId],
    );
    if (rows.length === 0) return null;
    const u = rows[0];
    if (u.role === 'empresa') return u.id;
    if (u.empresa_id) return u.empresa_id;
    // fallback: si es seller sin empresa_id, su propia empresa es él mismo
    return u.id;
  } catch {
    return null;
  }
}

export async function getTargetSellerIds(dataSource: DataSource, userId: string): Promise<string[]> {
  const empresaId = await getEmpresaIdForUser(dataSource, userId);
  if (!empresaId) return [userId]; // admin o no empresa
  // empresa -> todos sus vendedores + ella misma si hace falta
  const rows: any[] = await dataSource.query(`SELECT id FROM cobrokits.sellers WHERE empresa_id = $1`, [empresaId]);
  const ids = rows.map((r) => r.id);
  // incluir la empresa también para casos donde cobros/customers pertenecen a empresa
  ids.push(empresaId);
  return ids.length ? ids : [userId];
}

export function getUserIdFromRequest(req: any): string | null {
  return req.headers?.['x-user-id'] || req.user?.userId || req.user?.id || null;
}

// Schema del tenant resuelto por TenantMiddleware (via slug/host/JWT).
// Devuelve null si no hay tenant (llamador debe aplicar fail-closed: [] y no global).
export function getSchemaFromRequest(req: any): string | null {
  const s = req?.tenant?.schema;
  if (typeof s === 'string' && /^[a-z_][a-z0-9_]*$/i.test(s) && s !== 'cobrokits' && s !== 'public') return s;
  return null;
}
