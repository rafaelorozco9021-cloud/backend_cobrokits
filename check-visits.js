const http = require('http');

function get(path, token) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: 'localhost', port: 3001, path, method: 'GET', headers: token ? { Authorization: 'Bearer ' + token } : {} }, (res) => {
      let s = ''; res.on('data', (c) => { s += c; }); res.on('end', () => { try { resolve(JSON.parse(s)); } catch (e) { resolve(s); } });
    });
    r.on('error', reject); r.end();
  });
}

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0NzdlMWQ0YS0yNzk1LTRjNjItOGIwNC00YjY1OTEwNzdlZWUiLCJyb2xlIjoic2VsbGVyIiwiaWF0IjoxNzg4MzYzMDE0LCJleHAiOjE3ODg5Njc4MTR9.NyQqM7L6eg-YLRCOHX1iR_PFuOTHRugkHB5IO9TQR8Q';

async function main() {
  const visits = await get('/api/visits', TOKEN);
  console.log('VISITS (muestra):', JSON.stringify(Array.isArray(visits) ? visits.slice(-5) : visits, null, 2));
}
main().catch(e => console.log('ERR', e.message));