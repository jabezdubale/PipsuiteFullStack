
const BASE_URL = 'https://api.twelvedata.com/price';

// Map specific app symbols to Twelve Data tickers
// Twelve Data free tier typically uses these standard tickers
const SYMBOL_MAP: Record<string, string> = {
  'US30': 'DJI',      // Dow Jones Industrial Average
  'NAS100': 'NDX',    // Nasdaq 100
  'SPX500': 'SPX',    // S&P 500
  'GER30': 'DAX',     // DAX Performance Index
  'UK100': 'UKX',     // FTSE 100
  'JP225': 'NI225',   // Nikkei 225
  'USOIL': 'WTI',     // WTI Crude Oil
  'UKOIL': 'BRENT',   // Brent Crude Oil
};

export interface PriceResult {
  price: number;
  source?: string;
  sourceUrl?: string;
  timestamp?: number;
  raw?: any;
}

export const fetchCurrentPrice = async (symbol: string, apiKey: string): Promise<PriceResult | null> => {
  if (!apiKey) {
      console.warn("Twelve Data API Key is missing. Price fetch skipped.");
      return null;
  }

  let querySymbol = symbol;

  // 1. Check direct map for Indices/Commodities
  if (SYMBOL_MAP[symbol]) {
    querySymbol = SYMBOL_MAP[symbol];
  } 
  // 2. Format standard pairs (Forex/Crypto) 
  // Convert "XAUUSD" -> "XAU/USD", "BTCUSD" -> "BTC/USD"
  // Twelve Data generally requires the slash separator for pairs.
  else if (symbol.length === 6) {
    querySymbol = `${symbol.substring(0, 3)}/${symbol.substring(3)}`;
  }

  try {
    // Construct URL with API Key
    const url = `${BASE_URL}?symbol=${querySymbol}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        // If 401/403, it means key is invalid
        if (response.status === 401 || response.status === 403) {
            throw new Error("Invalid API Key");
        }
        throw new Error(`Network error: ${response.statusText}`);
    }

    const data = await response.json();

    // Handle Twelve Data API Errors (e.g., rate limits, invalid symbol, or invalid key returning 200 with error body)
    if (data.status === 'error' || data.code) {
        if (data.code === 401) throw new Error("Invalid API Key");
        console.warn(`Twelve Data API Error for ${querySymbol}:`, data.message);
        return null;
    }

    // Success response for /price endpoint: { "price": "2740.50" }
    // We explicitly check for 'price' as requested.
    if (data.price) {
        return {
            price: parseFloat(data.price),
            source: 'Twelve Data',
            timestamp: Date.now(), // /price endpoint doesn't return timestamp, so we assume 'now'
            raw: data
        };
    }

    return null;

  } catch (error) {
    console.error("Price Service Error:", error);
    throw error; // Re-throw so UI can handle display
  }
};
