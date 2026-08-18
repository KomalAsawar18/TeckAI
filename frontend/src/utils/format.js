/**
 * Format a price value with currency code or symbol.
 * Does not hardcode currency symbols inside components.
 * 
 * @param {number} value - The numeric price to format.
 * @param {string} currency - The currency code (default: 'PKR').
 * @returns {string} Formatted price string.
 */
export const formatPrice = (value, currency = 'PKR') => {
  if (value === undefined || value === null) return '';

  const cleanValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(cleanValue)) return '';

  if (currency === 'PKR') {
    // Standard localized Pakistani Rupee format (e.g., PKR 180,000)
    return `PKR ${cleanValue.toLocaleString('en-PK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(cleanValue);
  } catch (error) {
    // Graceful fallback if Intl fails
    return `${currency} ${cleanValue.toLocaleString()}`;
  }
};
