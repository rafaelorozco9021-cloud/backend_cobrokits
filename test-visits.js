require('dotenv').config();
const http = require('http');

function post(port, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname: 'localhost', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
    const r = http.request(opts, (res) => { let s = ''; res.on('data', c => s += c); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { resolve(s); } }); });
    r.on('error', reject); r.write(data); r.end();
  });
}
function get(port, path, token) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port, path, method: 'GET', headers: { Authorization: 'Bearer ' + token } };
    const r = http.request(opts, (res) => { let s = ''; res.on('data', c => s += c); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { resolve(s); } }); });
    r.on('error', reject); r.end();
  });
}

(async () => {
  const login = await post(3001, '/api/auth/login', { email: 'vendedor23@demo.cobrokits', password: 'Vendedor23*2026' });
  const token = login.token;
  console.log('Login OK, token:', token ? token.slice(0, 25) + '...' : 'NULO');

  const visits = await get(3001, '/api/visits', token);
  const arr = Array.isArray(visits) ? visits : (visits.data || []);
  console.log('Total visitas:', arr.length);

  const dc = arr.filter(v => String(v.cliente || '').includes('Don Carlos'));
  console.log('Visitas Don Carlos:', dc.length);
  if (dc.length) {
    console.log('DON CARLOS:', JSON.stringify(dc[0]));
  } else {
    // mostrar primeras 3 para depurar formato
    console.log('Muestra (primeros 3):');
    console.log(JSON.stringify(arr.slice(0, 3), null, 2));
  }
})().catch(e => console.log('ERR', e.message));