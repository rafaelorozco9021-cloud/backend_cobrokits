require('dotenv').config();
const http = require('http');

function post(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname: 'localhost', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const r = http.request(opts, (res) => { let s = ''; res.on('data', c => s += c); res.on('end', () => { try { resolve(JSON.parse(s)); } catch(e) { resolve(s); } }); });
    r.on('error', reject); r.write(data); r.end();
  });
}
function get(port, path, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port, path, method: 'GET', headers: { Authorization: 'Bearer ' + token } };
    const r = http.request(opts, (res) => { let s = ''; res.on('data', c => s += c); res.on('end', () => { try { resolve(JSON.parse(s)); } catch(e) { resolve(s); } }); });
    r.on('error', reject); r.end();
  });
}

(async () => {
  const login = await post(3001, '/api/auth/login', { email: 'esperanza@demo.cobrokits', password: 'Esperanza2026!' });
  const token = login.token;
  console.log('Login OK:', !!token);

  const visits = await get(3001, '/api/visits', token);
  const arr = Array.isArray(visits) ? visits : (visits.data || []);
  console.log('\nTotal visitas:', arr.length);

  // 1) VENTA DIARIA - Sep 2 (hoy, miércoles)
  console.log('\n=== VENTA DIARIA 2026-09-02 ===');
  const isoDate = '2026-09-02';
  const dayVisits = arr.filter(v => String(v.visit_date || '').slice(0,10) === isoDate);
  console.log('Visitas el', isoDate, ':', dayVisits.length);
  for (const v of dayVisits) {
    console.log(`  ${v.vendedor} | ${v.cliente} | venta:${v.venta} abono:${v.abono} deuda:${v.deuda} pago:${v.payment_method}`);
  }
  // SALDO ANT per seller (accumulated deuda <= date)
  const debtBySeller = new Map();
  for (const v of arr) {
    const vd = String(v.visit_date || '').slice(0,10);
    if (vd <= isoDate && Number(v.deuda) > 0) {
      debtBySeller.set(v.seller_id, (debtBySeller.get(v.seller_id) || 0) + Number(v.deuda));
    }
  }
  console.log('\nSALDO ANT. por vendedor al 02/09:');
  for (const [sid, debt] of debtBySeller.entries()) {
    const vendedor = arr.find(v => v.seller_id === sid)?.vendedor || sid;
    console.log(`  ${vendedor}: $${debt.toLocaleString()}`);
  }

  // 2) REPORTES SEMANALES - week of Aug 31 - Sep 6
  console.log('\n=== REPORTES SEMANALES (31/ago - 06/sep) ===');
  const weekDays = ['2026-08-31','2026-09-01','2026-09-02','2026-09-03','2026-09-04','2026-09-05','2026-09-06'];
  const dayNames = ['Lunes','Martes','Miercoles','Jueves','Viernes','Sabado','Domingo'];
  let runningDebt = 0;
  for (let i = 0; i < 7; i++) {
    const iso = weekDays[i];
    const dv = arr.filter(v => String(v.visit_date || '').slice(0,10) === iso);
    const deudaDia = dv.reduce((a,v) => a + Number(v.deuda || 0), 0);
    runningDebt += deudaDia;
    const cobros = dv.length;
    const venta = dv.reduce((a,v) => a + Number(v.venta || 0), 0);
    const abono = dv.reduce((a,v) => a + Number(v.abono || 0), 0);
    console.log(`  ${dayNames[i]} ${iso}: cobros=${cobros} venta=$${venta.toLocaleString()} abono=$${abono.toLocaleString()} deudaDia=$${deudaDia.toLocaleString()} SALDO_ANT=$${runningDebt.toLocaleString()}`);
  }

  // 3) REPORTE MENSUAL - September 2026
  console.log('\n=== REPORTE MENSUAL - Septiembre 2026 ===');
  let mRunningDebt = 0;
  for (let d = 1; d <= 30; d++) {
    const iso = `2026-09-${String(d).padStart(2,'0')}`;
    const dv = arr.filter(v => String(v.visit_date || '').slice(0,10) === iso);
    const deudaDia = dv.reduce((a,v) => a + Number(v.deuda || 0), 0);
    mRunningDebt += deudaDia;
    if (dv.length > 0 || deudaDia > 0 || mRunningDebt > 0) {
      const total = dv.reduce((a,v) => a + Number(v.abono || 0), 0);
      console.log(`  ${iso}: cobros=${dv.length} total=$${total.toLocaleString()} deudaDia=$${deudaDia.toLocaleString()} SALDO_ANT=$${mRunningDebt.toLocaleString()}`);
    }
  }

  await post(3001, '/api/auth/login', {}); // noop
})().catch(e => console.log('ERR', e.message));