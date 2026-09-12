const http = require('http');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0NzdlMWQ0YS0yNzk1LTRjNjItOGIwNC00YjY1OTEwNzdlZWUiLCJyb2xlIjoic2VsbGVyIiwiaWF0IjoxNzg4MzYzMDE0LCJleHAiOjE3ODg5Njc4MTR9.NyQqM7L6eg-YLRCOHX1iR_PFuOTHRugkHB5IO9TQR8Q';

const COBRO_ID = '38798a6d-a719-42dd-af68-46ef081c1d6a';
const SELLER_ID = '477e1d4a-2795-4c62-8b04-4b6591077eee';

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + TOKEN,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = http.request(opts, (res) => {
      let s = '';
      res.on('data', (c) => { s += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(s)); } catch(e) { resolve(s); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function main() {
  console.log('=== PASO 1: Crear cliente Don Carlos para cobro2miercoles ===');
  const cliente = await req('POST', '/api/customers', {
    name: 'Don Carlos - Abarrotes',
    phone: '3109991234',
    email: 'doncarlos@demo.cobrokits',
    address: 'Calle 45 #12-34 Barrio San Jose',
    seller_id: SELLER_ID,
    cobro_id: COBRO_ID,
  });
  console.log('Cliente creado:', JSON.stringify(cliente, null, 2));
  const clienteId = cliente.id || cliente.rows?.[0]?.id;

  if (!clienteId) {
    console.log('No se pudo crear cliente, abortando');
    return;
  }

  console.log('\n=== PASO 2: Registrar visita con venta de 100,000 y abono de 50,000 ===');
  const visitDate = '2026-09-02T10:30:00.000Z';
  const visit = await req('POST', '/api/visits', {
    customerId: clienteId,
    sellerId: SELLER_ID,
    cobroId: COBRO_ID,
    items: [
      { product_id: 'e7119fa1-0e08-4459-b36f-d0e895c90dbf', quantity: 2, unit_price: 23500 },
      { product_id: 'f5a507e9-4ec8-4b37-ac9a-68e45ef51718', quantity: 1, unit_price: 27500 },
      { product_id: '171b3e11-4a23-4ace-9da1-f8f2af84aafa', quantity: 1, unit_price: 13500 },
      { product_id: 'd792c831-6ed9-42d9-a3cf-d23d2dcb1467', quantity: 1, unit_price: 15200 },
    ],
    payment: 50000,
    paymentMethod: 'efectivo',
    notes: 'Abono parcial - Deuda pendiente 50,000',
    visitDate: visitDate,
  });
  console.log('Visita registrada:', JSON.stringify(visit, null, 2));

  const totalVenta = 2*23500 + 1*27500 + 1*13500 + 1*15200;
  console.log('\n=== RESUMEN ===');
  console.log('  Venta total (deuda):     $' + totalVenta.toLocaleString());
  console.log('  Abono (pago parcial):    $50,000');
  console.log('  Deuda pendiente:         $' + (totalVenta - 50000).toLocaleString());
  console.log('  Cliente:                 Don Carlos - Abarrotes');
  console.log('  Vendedor:                Sofia Herrera');
  console.log('  Cobro:                   cobro2miercoles (Grupo Miercoles)');
  console.log('  Productos:               5 items (Salchichon x2, Jamon, Mortadela, Longaniza)');
  console.log('\n=== TODO LISTO - Abre http://localhost:3000/dashboard ===');
}

main().catch(e => console.log('ERR:', e.message));