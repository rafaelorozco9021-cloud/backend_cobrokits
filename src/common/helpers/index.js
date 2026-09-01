/**
 * Helper functions for API routes
 * ok(successResponse) - returns success response
 * fail(errorResponse) - returns error response
 * query(dbClient, queryString, params) - runs a parameterized query
 */

export async function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function fail(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function query(client, text, params = []) {
  const { rows } = await client.query(text, params);
  return rows;
}