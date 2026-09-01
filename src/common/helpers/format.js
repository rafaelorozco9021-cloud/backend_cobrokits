export function formatMoney(amount) {
  // Format number as COP currency
  const num = parseFloat(amount);
  if (isNaN(num)) return '$0,00';
  
  // Round to 2 decimal places to avoid floating point issues
  const rounded = Math.round(num * 100) / 100;
  
  // Format with dots for thousands separator and comma for decimal
  const formatted = rounded.toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  // Handle negative numbers - move minus sign before $
  const isNegative = num < 0;
  let result = `$${formatted}`;
  if (isNegative) {
    result = `-${result}`;
  }
  
  return result;
}

// Additional formatting helpers
export function formatNumber(num) {
  return Number(num).toLocaleString('es-CO');
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('es-CO');
}