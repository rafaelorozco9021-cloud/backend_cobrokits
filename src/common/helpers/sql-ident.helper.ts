const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Valida que un nombre de schema/tabla/columna solo contenga identificadores SQL seguros.
 * Lanza error si contiene caracteres peligrosos (espacios, comillas, punto, guiones, etc.).
 */
export function assertSafeIdent(name: string): string {
  if (!name || !SAFE_IDENT.test(name)) {
    throw new Error(`[security] Identificador SQL inválido: "${name}"`);
  }
  return name;
}

export function isValidIdent(name: string): boolean {
  return !!name && SAFE_IDENT.test(name);
}