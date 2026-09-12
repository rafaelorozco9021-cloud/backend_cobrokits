require('dotenv').config();
const {Pool}=require('pg');
(async()=>{
  const p=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  const schemas=['cobrokits','empresa_ea85157d','empresa_50c057f0','empresa_d31f3e96','public'];
  for(const s of schemas){
    console.log('\n== '+s+' ==');
    let r=await p.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename',[s]);
    for(const t of r.rows){
      try{
        let c=await p.query('SELECT count(*)::int as c FROM '+s+'.'+t.tablename);
        if(c.rows[0].c>0) console.log('  '+t.tablename+': '+c.rows[0].c);
      }catch(e){}
    }
    if(s==='public'){
      try{ let c=await p.query('SELECT count(*)::int as c FROM public.tenants'); console.log('  tenants: '+c.rows[0].c);}catch(e){}
    }
    if(s==='cobrokits'){
      // check sellers details
      try{
        let c=await p.query('SELECT email, role FROM cobrokits.sellers');
        console.log('  sellers detail:',c.rows);
      }catch(e){}
    }
  }
  await p.end();
})()
