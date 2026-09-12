require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function schemaForEmpresa(id){ return 'empresa_' + id.replace(/-/g,'').slice(0,8); }

async function provisionEmpresa(empresaId, name){
  const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  const schema=schemaForEmpresa(empresaId);
  console.log(`Provision ${name} ${empresaId} -> ${schema}`);
  // tenants registry
  await pool.query(`INSERT INTO public.tenants (id, slug, schema_name, name) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET schema_name=EXCLUDED.schema_name, name=EXCLUDED.name`, [empresaId, schema, schema, name]);
  // create schema
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  // apply template: use cobrokits_schema_nuevo.sql but adapt search_path and remove empresa_id if needed (keep for compat)
  const sqlPath=path.resolve(__dirname,'..','database','cobrokits_schema_nuevo.sql');
  let sql=fs.readFileSync(sqlPath,'utf-8');
  // replace SET search_path line to target schema
  sql=sql.replace(/CREATE SCHEMA IF NOT EXISTS cobrokits;\s*\nSET search_path TO cobrokits,public;/, `SET search_path TO ${schema}, public;`);
  // ensure we don't try to CREATE SCHEMA cobrokits inside tenant
  await pool.query(`BEGIN`);
  try{
    await pool.query(sql);
    await pool.query(`COMMIT`);
    console.log(`  schema ${schema} created`);
  }catch(e){
    await pool.query(`ROLLBACK`);
    if(e.message.includes('already exists')){
      console.log(`  schema exists, continue`);
    } else {
      console.error('  error applying sql', e.message.slice(0,300));
      // try to continue even if types exist
    }
  }
  // copy data from cobrokits where empresa_id = empresaId
  const tables=[
    {name:'sellers', where:`WHERE empresa_id=$1 OR id=$1`},
    {name:'products', where:`WHERE empresa_id=$1`},
    {name:'cobros', where:`WHERE empresa_id=$1`},
    {name:'customers', where:`WHERE empresa_id=$1`},
    {name:'seller_inventory', where:`WHERE seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)`},
    {name:'warehouse_stock', where:`WHERE product_id IN (SELECT id FROM cobrokits.products WHERE empresa_id=$1)`},
    {name:'warehouse_stock_entries', where:`WHERE product_id IN (SELECT id FROM cobrokits.products WHERE empresa_id=$1)`},
    {name:'customer_visits', where:`WHERE seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)`},
    {name:'daily_seller_stock', where:`WHERE seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)`},
  ];
  for(const t of tables){
    try{
      const cnt=await pool.query(`SELECT count(*) FROM cobrokits.${t.name} ${t.where}`, [empresaId]);
      if(Number(cnt.rows[0].count)===0) continue;
      // delete existing in tenant to avoid dup
      await pool.query(`DELETE FROM ${schema}.${t.name}`);
      // copy: need column list
      const cols=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='cobrokits' AND table_name=$1 ORDER BY ordinal_position`, [t.name]);
      const colList=cols.rows.map(r=>r.column_name).join(',');
      await pool.query(`INSERT INTO ${schema}.${t.name} (${colList}) SELECT ${colList} FROM cobrokits.${t.name} ${t.where}`, [empresaId]);
      console.log(`  copied ${t.name}: ${cnt.rows[0].count}`);
    }catch(e){ console.log(`  skip ${t.name}:`, e.message.slice(0,120)); }
  }
  // copy payments and visit_items via visits
  try{
    const visitIds=await pool.query(`SELECT id FROM cobrokits.customer_visits WHERE seller_id IN (SELECT id FROM cobrokits.sellers WHERE empresa_id=$1)`,[empresaId]);
    if(visitIds.rows.length){
      const ids=visitIds.rows.map(r=>r.id);
      await pool.query(`DELETE FROM ${schema}.customer_visit_items`);
      await pool.query(`DELETE FROM ${schema}.payments`);
      const pcols=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='cobrokits' AND table_name='payments' ORDER BY ordinal_position`);
      const pcolList=pcols.rows.map(r=>r.column_name).join(',');
      await pool.query(`INSERT INTO ${schema}.payments (${pcolList}) SELECT ${pcolList} FROM cobrokits.payments WHERE visit_id = ANY($1::uuid[]) OR seller_id = ANY((SELECT array_agg(id) FROM cobrokits.sellers WHERE empresa_id=$2)::uuid[])`, [ids, empresaId]).catch(e=>console.log('  payments copy err',e.message.slice(0,80)));
      const icols=await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='cobrokits' AND table_name='customer_visit_items' ORDER BY ordinal_position`);
      const icolList=icols.rows.map(r=>r.column_name).join(',');
      await pool.query(`INSERT INTO ${schema}.customer_visit_items (${icolList}) SELECT ${icolList} FROM cobrokits.customer_visit_items WHERE visit_id = ANY($1::uuid[])`, [ids]).catch(e=>console.log('  items copy err',e.message.slice(0,80)));
      console.log(`  copied payments/items for ${ids.length} visits`);
    }
  }catch(e){ console.log('  payments/items skip',e.message.slice(0,80));}
  await pool.end();
  console.log(`Done ${schema}\n`);
}

async function main(){
  const args=process.argv.slice(2);
  if(args.includes('--all')){
    const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
    const r=await pool.query(`SELECT id, name FROM cobrokits.sellers WHERE role='empresa' ORDER BY name`);
    await pool.end();
    for(const row of r.rows){ await provisionEmpresa(row.id, row.name); }
  } else {
    const id=args[0]; const name=args[1]||'Empresa';
    if(!id){ console.error('Usage: node scripts/provision-tenant.js --all  OR  node scripts/provision-tenant.js <empresaId> <name>'); process.exit(1); }
    await provisionEmpresa(id, name);
  }
}
main().catch(e=>{console.error(e); process.exit(1);});
