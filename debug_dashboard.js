require('dotenv').config();
const {Pool}=require('pg');
(async()=>{
  const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await pool.query('SET search_path TO cobrokits,public');
  const sellerId='7a2074a7-0589-4ae6-a0c7-429404cec053'; // esperanza
  const now=new Date();
  const bogotaDate=new Date(now.toLocaleString('en-US',{timeZone:'America/Bogota'}));
  const todayDate=bogotaDate.toISOString().split('T')[0];
  console.log('today',todayDate, 'seller',sellerId);
  try{
    const r=await pool.query(`SELECT role FROM cobrokits.sellers WHERE id=$1`,[sellerId]);
    console.log('role',r.rows);
    const role=r[0]?.role;
    const isEmpresa=role==='empresa';
    console.log('isEmpresa',isEmpresa);
    let targetSellerIds=[sellerId];
    if(isEmpresa){
      const vends=await pool.query(`SELECT id FROM cobrokits.sellers WHERE empresa_id=$1`,[sellerId]);
      console.log('vends',vends.rows);
      targetSellerIds=vends.rows.map(v=>v.id);
      if(targetSellerIds.length===0) targetSellerIds=[sellerId];
    }
    console.log('targetIds',targetSellerIds);
    // target
    try{
      const target = isEmpresa ? await pool.query(`SELECT COALESCE(SUM(cobrokits.get_collection_target(sid, $2)),0) as target FROM unnest($1::uuid[]) as sid`,[targetSellerIds, todayDate]) : await pool.query(`SELECT cobrokits.get_collection_target($1,$2) as target`,[sellerId, todayDate]);
      console.log('target ok',target.rows);
    }catch(e){ console.error('target fail',e.message, e.code, e.detail)}
    // sellers
    try{
      const sellers=await pool.query('SELECT id, name, email, status, role, empresa_id FROM cobrokits.sellers ORDER BY name');
      console.log('sellers ok',sellers.rows.length);
    }catch(e){ console.error('sellers fail',e.message)}
    // balances
    try{
      const balances = isEmpresa ? await pool.query(`SELECT seller_id, date, total_sales, total_delivered, total_sold, is_closed FROM cobrokits.daily_seller_stock WHERE seller_id = ANY($1::uuid[]) AND date = $2`,[targetSellerIds, todayDate]) : await pool.query(`SELECT seller_id, date, total_sales, total_delivered, total_sold, is_closed FROM cobrokits.daily_seller_stock WHERE date = $1`,[todayDate]);
      console.log('balances ok',balances.rows.length);
    }catch(e){ console.error('balances fail',e.message)}
    // week
    try{
      const weekStart=new Date(bogotaDate); weekStart.setDate(bogotaDate.getDate()-bogotaDate.getDay()); const weekEnd=new Date(weekStart); weekEnd.setDate(weekEnd.getDate()+6);
      const weekData = isEmpresa ? await pool.query(`SELECT d.date, COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'efectivo'),0) as efectivo FROM cobrokits.daily_seller_stock d LEFT JOIN cobrokits.payments p ON p.seller_id=d.seller_id AND p.created_at::date=d.date WHERE d.seller_id = ANY($1::uuid[]) AND d.date BETWEEN $2 AND $3 GROUP BY d.date ORDER BY d.date`,[targetSellerIds, weekStart.toISOString(), weekEnd.toISOString()]) : await pool.query(`SELECT d.date FROM cobrokits.daily_seller_stock d WHERE d.seller_id=$1 AND d.date BETWEEN $2 AND $3 GROUP BY d.date`,[sellerId, weekStart.toISOString(), weekEnd.toISOString()]);
      console.log('week ok',weekData.rows);
    }catch(e){ console.error('week fail',e.message, e.detail, e.where)}
    // lowStock
    try{
      const low = isEmpresa ? await pool.query(`SELECT si.product_id, p.name, si.quantity, si.cost_price, si.seller_id FROM cobrokits.seller_inventory si JOIN cobrokits.products p ON si.product_id=p.id WHERE si.seller_id = ANY($1::uuid[]) AND si.quantity <=5`,[targetSellerIds]) : await pool.query(`SELECT si.product_id, p.name, si.quantity, si.cost_price FROM cobrokits.seller_inventory si JOIN cobrokits.products p ON si.product_id=p.id WHERE si.seller_id=$1 AND si.quantity <=5`,[sellerId]);
      console.log('low ok',low.rows.length);
    }catch(e){ console.error('low fail',e.message)}
  }catch(e){ console.error('outer',e)}
  await pool.end();
})();
