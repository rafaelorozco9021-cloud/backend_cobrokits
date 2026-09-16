/**
 * Auditoría de fuga multiempresa (tenant leak).
 *
 * Uso:
 *   node scripts/audit-tenant-leak.js            -> solo reporte (no toca datos)
 *   node scripts/audit-tenant-leak.js --fix      -> elimina filas cross-tenant de schemas empresa_*
 *
 * Lee DATABASE_URL del .env. No borra nada de cobrokits (espejo global por diseño
 * dual-write); solo limpia schemas de tenant contaminados (empresa_id ajeno).
 */
require('dotenv').config();
const { Client } = require('pg');

const FIX = process.argv.includes('--fix');

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
}

async function tableExists(c, schema, table) {
  const r = await c.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
    [schema, table],
  );
  return r.rowCount > 0;
}

async function hasColumn(c, schema, table, col) {
  const r = await c.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3`,
    [schema, table, col],
  );
  return r.rowCount > 0;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definido. Copia .env.example a .env');
    process.exit(1);
  }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const report = { tenants: [], cobrokits: {}, crossTenantRows: [], nullEmpresaId: {}, duplicates: [] };

  // 1) Tenants registrados
  let tenants = [];
  try {
    const r = await c.query(`SELECT id, schema_name, name FROM public.tenants ORDER BY name`);
    tenants = r.rows;
  } catch (e) {
    console.log('[warn] public.tenants no existe:', e.message);
  }
  console.log(`Tenants registrados: ${tenants.length}`);
  for (const t of tenants) console.log(` - ${t.name} id=${t.id} schema=${t.schema_name}`);

  // Empresas (rol empresa) en cobrokits
  const empresas = await c.query(
    `SELECT id, name, email FROM cobrokits.sellers WHERE role='empresa' ORDER BY name`,
  ).catch(() => ({ rows: [] }));
  console.log(`\nEmpresas en cobrokits.sellers: ${empresas.rows.length}`);
  for (const e of empresas.rows) console.log(` - ${e.name} <${e.email}> id=${e.id}`);

  // 2) Conteos globales cobrokits
  for (const tbl of ['sellers', 'products', 'customers', 'cobros', 'warehouse_stock', 'seller_inventory']) {
    if (!(await tableExists(c, 'cobrokits', tbl))) {
      report.cobrokits[tbl] = 'sin tabla';
      continue;
    }
    const r = await c.query(`SELECT count(*)::int AS n FROM cobrokits.${tbl}`);
    report.cobrokits[tbl] = r.rows[0].n;
  }
  console.log('\nConteos cobrokits (espejo global esperado):', JSON.stringify(report.cobrokits));

  // 3) Por empresa en cobrokits (debería ser ~3 sellers, ~10 products si hay 3 empresas como en imágenes)
  if (await hasColumn(c, 'cobrokits', 'sellers', 'empresa_id')) {
    const r = await c.query(
      `SELECT e.name AS empresa, count(s.id)::int AS sellers
       FROM cobrokits.sellers e LEFT JOIN cobrokits.sellers s ON s.empresa_id=e.id AND s.role='seller'
       WHERE e.role='empresa' GROUP BY e.name ORDER BY e.name`,
    );
    console.log('\nSellers por empresa (cobrokits):');
    for (const row of r.rows) console.log(` - ${row.empresa}: ${row.sellers}`);
    report.sellersPorEmpresa = r.rows;

    // Detección del patrón de la imagen: mismo nombre+teléfono en varias empresas
    const dup = await c.query(
      `SELECT name, phone, count(DISTINCT empresa_id)::int AS empresas, count(*)::int AS filas,
              string_agg(DISTINCT email, ' | ') AS emails
       FROM cobrokits.sellers WHERE role='seller'
       GROUP BY name, phone HAVING count(DISTINCT empresa_id) > 1 ORDER BY name`,
    );
    report.duplicates = dup.rows;
    if (dup.rows.length) {
      console.log('\n[MEZCLA VISIBLE] Mismo vendedor en varias empresas (como Imagen 2):');
      for (const d of dup.rows) console.log(` - ${d.name} tel=${d.phone} empresas=${d.empresas} filas=${d.filas} emails=${d.emails}`);
    } else {
      console.log('\nSin vendedores repetidos entre empresas.');
    }

    const nullEmp = await c.query(
      `SELECT 'sellers' AS t, count(*)::int AS n FROM cobrokits.sellers WHERE role='seller' AND empresa_id IS NULL
       UNION ALL SELECT 'products', count(*) FROM cobrokits.products WHERE empresa_id IS NULL
       UNION ALL SELECT 'customers', count(*) FROM cobrokits.customers WHERE empresa_id IS NULL`,
    ).catch(() => ({ rows: [] }));
    report.nullEmpresaId = nullEmp.rows;
    console.log('\nFilas con empresa_id NULL (invisibles tras fail-closed, requieren backfill):', JSON.stringify(nullEmp.rows));
  }

  // 4) Contaminación en schemas de tenant: filas con empresa_id ajeno al tenant.
  // NOTA: si el tenant apunta al schema compartido 'cobrokits' (despliegue actual:
  // sin schemas físicos empresa_*), NO es contaminación: cobrokits es espejo global
  // por diseño y el aislamiento lo da empresa_id en lectura (fail-closed).
  for (const t of tenants) {
    const schema = t.schema_name;
    if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) continue;
    if (schema === 'cobrokits' || schema === 'public') {
      console.log(`\n[info] tenant ${t.name} usa schema compartido '${schema}': aislamiento por empresa_id (ver sellers por empresa arriba).`);
      continue;
    }
    const perTenant = { tenant: t.name, schema };
    for (const tbl of ['sellers', 'products', 'customers', 'cobros']) {
      if (!(await tableExists(c, schema, tbl))) {
        perTenant[tbl] = 'sin tabla';
        continue;
      }
      const hasEmp = await hasColumn(c, schema, tbl, 'empresa_id');
      const cnt = await c.query(`SELECT count(*)::int AS n FROM ${schema}.${tbl}`);
      perTenant[tbl] = cnt.rows[0].n;
      if (hasEmp && isUuid(t.id)) {
        const bad = await c.query(
          `SELECT count(*)::int AS n FROM ${schema}.${tbl} WHERE empresa_id IS NOT NULL AND empresa_id <> $1`,
          [t.id],
        );
        if (bad.rows[0].n > 0) {
          report.crossTenantRows.push({ schema, table: tbl, tenant: t.name, bad: bad.rows[0].n });
          console.log(`\n[CONTAMINADO] ${schema}.${tbl}: ${bad.rows[0].n} filas con empresa_id ajeno a ${t.name}`);
          const sample = await c.query(
            `SELECT id, name, empresa_id FROM ${schema}.${tbl} WHERE empresa_id IS NOT NULL AND empresa_id <> $1 LIMIT 5`,
            [t.id],
          );
          for (const s of sample.rows) console.log(`   ej: ${s.name} id=${s.id} empresa_id=${s.empresa_id}`);
          if (FIX) {
            const del = await c.query(
              `DELETE FROM ${schema}.${tbl} WHERE empresa_id IS NOT NULL AND empresa_id <> $1`,
              [t.id],
            );
            console.log(`   [FIX] eliminadas ${del.rowCount} filas cross-tenant de ${schema}.${tbl}`);
          }
        }
      }
    }
    report.tenants.push(perTenant);
  }

  console.log('\nResumen por tenant:', JSON.stringify(report.tenants, null, 1));
  if (!report.crossTenantRows.length) console.log('\nOK: ningún schema de tenant contiene filas de otra empresa.');
  else if (!FIX) console.log('\nRe-ejecuta con --fix para eliminar esas filas cross-tenant (no toca cobrokits).');

  console.log('\nNOTA: cobrokits.* es espejo global por diseño (dual-write). Tras el fix fail-closed cada empresa solo lee su schema o su empresa_id, así que 9 sellers globales se ven como 3 por empresa. No borrar cobrokits sin migrar primero.');
  await c.end();
}

main().catch((e) => {
  console.error('audit failed:', e.message);
  process.exit(1);
});
