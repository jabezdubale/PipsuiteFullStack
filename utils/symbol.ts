
import { ASSETS } from '../types';

export const getBaseQuote = (symbol: string): { base: string; quote: string } | null => {
  if (!symbol) return null;
  
  const s = symbol.toUpperCase().trim();

  // 1. Check strict definition in ASSETS (Source of Truth)
  const known = ASSETS.find(a => a.assetPair === s);
  if (known) {
      return { base: known.base, quote: known.quote };
  }

  // 2. Fallback Heuristics for unknown symbols

  // Handle standard 6-character pairs (Forex, Metals, some Crypto)
  // e.g. EURUSD, USDJPY, XAUUSD, BTCUSD
  if (s.length === 6) {
    return {
      base: s.substring(0, 3),
      quote: s.substring(3, 6)
    };
  }

  // Handle pairs with explicit slash separator (e.g. BTC/USD)
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 2) {
      return { base: parts[0], quote: parts[1] };
    }
  }

  // Default fallback for unknown formats
  return null;
};
