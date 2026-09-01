import { test } from 'node:test';
import assert from 'node:assert';
import { ok, fail } from '../src/common/helpers/index.js';

console.log('Running api-utils.test.mjs...');

// Test ok helper - check it returns a Response object
test('ok should return a Response with status 200', async () => {
  const result = await ok({ success: true }, 200);
  assert.ok(result instanceof Response, 'ok should return a Response');
  assert.strictEqual(result.status, 200, 'ok should return status 200');
  assert.strictEqual(result.headers.get('content-type'), 'application/json', 'ok should set content-type json');
});

// Test fail helper - check it returns a Response object
test('fail should return a Response with status 400', async () => {
  const result = await fail('Test error', 400);
  assert.ok(result instanceof Response, 'fail should return a Response');
  assert.strictEqual(result.status, 400, 'fail should return status 400');
  assert.strictEqual(result.headers.get('content-type'), 'application/json', 'fail should set content-type json');
  
  const body = await result.json();
  assert.deepStrictEqual(body, { error: 'Test error' }, 'fail should return error message');
});

// Test ok returns correct data
test('ok should return data wrapped correctly', async () => {
  const result = await ok({ success: true, data: [1, 2, 3] }, 200);
  const body = await result.json();
  assert.ok(body.success === true, 'ok should have success=true');
  assert.deepStrictEqual(body.data, [1, 2, 3], 'ok should return the data');
});

// Test ok with default status
test('ok should use default status 200', async () => {
  const result = await ok({ message: 'ok' });
  assert.strictEqual(result.status, 200, 'ok should default to status 200');
});

// Test fail with default status
test('fail should use default status 400', async () => {
  const result = await fail('error');
  assert.strictEqual(result.status, 400, 'fail should default to status 400');
});