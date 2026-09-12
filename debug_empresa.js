require('dotenv').config();
const {Pool}=require('pg');
(async()=>{
  const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await pool.query('SET search_path TO cobrokits,public');
  const sellerId='7a2074a7-0589-4ae6-a0c7-429404cec053';
  const now=new Date();
  const bogotaDate=new Date(now.toLocaleString('en-US',{timeZone:'America/Bogota'}));
  const todayDate=bogotaDate.toISOString().split('T')[0];
  console.log('today',todayDate, 'now',now.toISOString(), 'bogota',bogotaDate.toISOString());
  const r=await pool.query(`SELECT id, role, empresa_id FROM cobrokits.sellers WHERE id=$1`,[sellerId]);
  console.log('seller',r.rows[0]);
  console.log('role raw',JSON.stringify(r.rows[0].role), 'len',r.rows[0].role.length, 'codes', [...r.rows[0].role].map(c=>c.charCodeAt(0)));
  const role=r.rows[0].role;
  console.log('role===empresa',role==='empresa', 'trim===',role.trim()==='empresa');
  // Force empresa
  const vends=await pool.query(`SELECT id FROM cobrokits.sellers WHERE empresa_id=$1`,[sellerId]);
  console.log('vends',vends.rows);
  const targetSellerIds=vends.rows.map(v=>v.id);
  console.log('targetIds',targetSellerIds);
  try{
    const target=await pool.query(`SELECT COALESCE(SUM(cobrokits.get_collection_target(sid, $2)),0) as target FROM unnest($1::uuid[]) as sid`,[targetSellerIds, todayDate]);
    console.log('target empresa ok',target.rows);
  }catch(e){ console.error('target empresa fail',e.message, e.code, e.detail)}
  try{
    const balances=await pool.query(`SELECT seller_id, date, total_sales FROM cobrokits.daily_seller_stock WHERE seller_id = ANY($1::uuid[]) AND date = $2`,[targetSellerIds, todayDate]);
    console.log('balances empresa ok',balances.rows.length, balances.rows.slice(0,2));
  }catch(e){ console.error('balances empresa fail',e.message)}
  try{
    const weekStart=new Date(bogotaDate); weekStart.setDate(bogotaDate.getDate()-bogotaDate.getDay()); const weekEnd=new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
    const week=await pool.query(`SELECT d.date, COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method='efectivo'),0) as efectivo FROM cobrokits.daily_seller_stock d LEFT JOIN cobrokits.payments p ON p.seller_id=d.seller_id AND p.created_at::date=d.date WHERE d.seller_id = ANY($1::uuid[]) AND d.date BETWEEN $2 AND $3 GROUP BY d.date ORDER BY d.date`,[targetSellerIds, weekStart.toISOString(), weekEnd.toISOString()]);
    console.log('week empresa ok',week.rows);
  }catch(e){ console.error('week empresa fail',e.message, e.detail)}
  await pool.end();
})();
