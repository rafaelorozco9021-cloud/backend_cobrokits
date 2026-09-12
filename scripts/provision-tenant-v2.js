require('dotenv').config();
const { Pool } = require('pg');
function schemaFor(id){ return 'empresa_' + id.replace(/-/g,'').slice(0,8); }
async function cloneSchema(pool, src, dst){
  // create schema if not exists - reuse enums from src (cobrokits) to avoid type mismatch
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${dst}`);
  // DO NOT clone enums - tenant tables will reference cobrokits.payment_method etc. via LIKE
  // Ensure search_path includes cobrokits for type resolution
  await pool.query(`SET search_path TO ${dst}, ${src}, public`);
  // clone tables structure (LIKE including all)
  const tables=await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename`,[src]);
  for(const row of tables.rows){
    const tbl=row.tablename;
    const exists=await pool.query(`SELECT 1 FROM pg_tables WHERE schemaname=$1 AND tablename=$2`,[dst, tbl]);
    if(exists.rows.length) continue;
    await pool.query(`CREATE TABLE ${dst}.${tbl} (LIKE ${src}.${tbl} INCLUDING ALL)`);
    console.log(`  table ${dst}.${tbl} created`);
  }
  // clone views
  const views=await pool.query(`SELECT viewname, definition FROM pg_views WHERE schemaname=$1`,[src]);
  for(const v of views.rows){
    const exists=await pool.query(`SELECT 1 FROM pg_views WHERE schemaname=$1 AND viewname=$2`,[dst, v.viewname]);
    if(exists.rows.length) continue;
    // definition contains schema prefix, replace
    let def=v.definition.replace(new RegExp(src, 'g'), dst);
    await pool.query(`CREATE OR REPLACE VIEW ${dst}.${v.viewname} AS ${def}`);
    console.log(`  view ${v.viewname}`);
  }
  // clone functions (get functions in schema)
  const funcs=await pool.query(`SELECT n.nspname, p.proname, pg_get_functiondef(p.oid) as def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1`,[src]);
  for(const f of funcs.rows){
    let def=f.def;
    // replace schema prefix
    def=def.replace(new RegExp(`\\b${src}\\b`,'g'), dst);
    // ensure search_path not hardcoded
    try{ await pool.query(def); console.log(`  func ${f.proname}`);}catch(e){ console.log(`  func ${f.proname} skip:`, e.message.slice(0,80));}
  }
}

async function provisionOne(empresaId, name){
  const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  const dst=schemaFor(empresaId);
  console.log(`Provision ${name} ${empresaId} -> ${dst}`);
  await pool.query(`INSERT INTO public.tenants (id, slug, schema_name, name) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET schema_name=EXCLUDED.schema_name, name=EXCLUDED.name`,[empresaId, dst, dst, name]);
  await cloneSchema(pool, 'cobrokits', dst);
  // copy data
  const tablesToCopy=['sellers','products','cobros','customers','seller_inventory','warehouse_stock','warehouse_stock_entries','customer_visits','daily_seller_stock','customer_visit_items','payments','inventory_movements','daily_seller_entries','cobro_sellers'];
  for(const tbl of tablesToCopy){
    try{
      const cnt=await pool.query(`SELECT count(*) FROM cobrokits.${tbl} WHERE 1=1`);
      // filtered copy per empresa
      let where='';
      if(['sellers'].includes(tbl)) where=`WHERE empresa_id=$1 OR id=$1`;
      else if(['products','cobros','customers'].includes(tbl)) where=`WHERE empresa_id=$1`;
      else if(['seller_inventory','warehouse_stock_entries','daily_seller_stock','daily_seller_entries','inventory_movements','cobro_sellers'].includes(tbl)) where=`WHERE seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)`;
      else if(['warehouse_stock'].includes(tbl)) where=`WHERE product_id IN (SELECT id FROM cobrokits.products WHERE empresa_id=$1)`;
      else if(['customer_visits'].includes(tbl)) where=`WHERE seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)`;
      else if(['customer_visit_items','payments'].includes(tbl)) where=`WHERE visit_id IN (SELECT id FROM cobrokits.customer_visits WHERE seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)) OR seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)`;
      else where=`WHERE empresa_id=$1`;
      const srcCount=await pool.query(`SELECT count(*) FROM cobrokits.${tbl} ${where}`,[empresaId]);
      if(Number(srcCount.rows[0].count)===0){ console.log(`  skip ${tbl} 0 rows`); continue; }
      await pool.query(`DELETE FROM ${dst}.${tbl}`);
      const colsRes=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='cobrokits' AND table_name=$1 ORDER BY ordinal_position`,[tbl]);
      if(colsRes.rows.length===0) continue;
      const cols=colsRes.rows.map(r=>r.column_name).join(',');
      await pool.query(`INSERT INTO ${dst}.${tbl} (${cols}) SELECT ${cols} FROM cobrokits.${tbl} ${where}`,[empresaId]);
      console.log(`  copied ${tbl}: ${srcCount.rows[0].count}`);
    }catch(e){ console.log(`  skip ${tbl}:`, e.message.slice(0,150));}
  }
  await pool.end();
  console.log(`Done ${dst}\n`);
}

async function main(){
  const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  const r=await pool.query(`SELECT id, name FROM cobrokits.sellers WHERE role='empresa' ORDER BY name`);
  await pool.end();
  for(const row of r.rows) await provisionOne(row.id, row.name);
}
main().catch(e=>{console.error(e); process.exit(1);});
