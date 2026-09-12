const http = require('http');

function get(path, token) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: 'localhost', port: 3001, path, method: 'GET', headers: { Authorization: 'Bearer ' + token } }, (res) => {
      let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { resolve(s); } });
    });
    r.on('error', reject); r.end();
  });
}

async function main() {
  const token = process.argv[2];
  const visits = await get('/api/visits', token);
  if (!Array.isArray(visits)) { console.log('No array', JSON.stringify(visits)); return; }

  console.log('=== VISITAS CON DEUDA > 0 ===');
  const withDebt = visits.filter((v) => Number(v.deuda) > 0);
  withDebt.sort((a, b) => (a.visit_date || '').localeCompare(b.visit_date || ''));
  for (const v of withDebt) {
    console.log(`${v.visit_date?.slice(0,10)} | venta=${v.venta} abono=${v.abono} deuda=${v.deuda} | cliente=${v.cliente} vendedor=${v.vendedor} pm=${v.payment_method}`);
  }

  console.log('\n=== RESUMEN DEUDA POR DIA ===');
  const byDay = {};
  for (const v of visits) {
    const d = (v.visit_date || v.created_at || '').slice(0, 10);
    if (Number(v.deuda) > 0) byDay[d] = (byDay[d] || 0) + Number(v.deuda);
  }
  for (const d of Object.keys(byDay).sort()) console.log(d, '->', byDay[d]);

  console.log('\n=== TOTAL VISITAS, TOTAL DEUDA ===');
  console.log('visitas totales:', visits.length);
  console.log('deuda total:', visits.reduce((a, v) => a + Number(v.deuda || 0), 0));
}
main().catch(e => console.log('ERR', e.message));