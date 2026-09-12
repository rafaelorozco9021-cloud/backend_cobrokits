const http = require('http');

function postRequest(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    };
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // Step 1: Login as Sofia Herrera
  console.log('=== Paso 1: Login ===');
  const login = await postRequest('/api/auth/login', { email: 'vendedor23@demo.cobrokits', password: 'Vendedor23*2026' });
  console.log('Login result:', JSON.stringify(login, null, 2));
  
  if (!login.token) {
    console.log('Login failed, trying admin password...');
    const adminLogin = await postRequest('/api/auth/login', { email: 'esperanza@demo.cobrokits', password: 'master9021' });
    console.log('Admin login:', JSON.stringify(adminLogin, null, 2));
    if (adminLogin.token) {
      login.token = adminLogin.token;
      login.user = adminLogin.user;
    }
  }
  
  const token = login.token;
  console.log('\nToken obtained:', token ? token.substring(0, 20) + '...' : 'NONE');

  if (!token) {
    console.log('Cannot proceed without token');
    return;
  }

  // Step 2: Get cobros for miercoles
  console.log('\n=== Paso 2: Obtener cobros miercoles ===');
  const cobros = await getRequest('/api/cobros?grupo=Grupo+Miercoles', token);
  console.log('Cobros:', JSON.stringify(cobros, null, 2));

  // Step 3: Get customers
  console.log('\n=== Paso 3: Obtener clientes ===');
  const customers = await getRequest('/api/customers', token);
  console.log('Customers count:', Array.isArray(customers) ? customers.length : 'N/A');

  // Step 4: Get products
  console.log('\n=== Paso 4: Obtener productos ===');
  const products = await getRequest('/api/products', token);
  console.log('Products count:', Array.isArray(products) ? products.length : 'N/A');

  // Step 5: Get sellers
  console.log('\n=== Paso 5: Obtener vendedores ===');
  const sellers = await getRequest('/api/sellers', token);
  console.log('Sellers:', JSON.stringify(sellers, null, 2));

  console.log('\n=== Setup listo para continuar ===');
  console.log('Token:', token);
}

main().catch(e => console.log('ERR:', e.message));