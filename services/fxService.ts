
import { getUsers } from './storageService';

interface CacheEntry {
  rate: number; // Conversion multiplier (Quote -> USD)
  pair: string;
  timestamp: number;
}

const rateCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 60 * 1000; // 60 seconds

// Currencies that are typically the BASE in a pair with USD (e.g. EURUSD).
// For these, the API returns USD per Unit.
const DIRECT_PAIRS = new Set(['EUR', 'GBP', 'AUD', 'NZD', 'XAU', 'XAG', 'BTC', 'ETH', 'SOL', 'BNB']);

const getApiKey = async (): Promise<string | null> => {
    const userId = localStorage.getItem('pipsuite_current_user_id');
    if (!userId) return null;
    try {
        const users = await getUsers();
        const user = users.find(u => u.id === userId);
        return user?.twelveDataApiKey || null;
    } catch {
        return null;
    }
};

// Helper to determine metadata (rate and pair name)
const getFxMetaData = async (quoteCurrency: string): Promise<{ rate: number, pair: string } | null> => {
    const code = quoteCurrency.toUpperCase();
    if (code === 'USD') return { rate: 1, pair: 'USD' };

    // Check Cache
    const cached = rateCache[code];
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return { rate: cached.rate, pair: cached.pair };
    }

    const apiKey = await getApiKey();
    if (!apiKey) return null;

    let pair = '';
    let isDirect = false;

    // Determine pair naming convention
    // If currency is EUR, pair is EURUSD (Direct)
    // If currency is JPY, pair is USDJPY (Indirect)
    if (DIRECT_PAIRS.has(code)) {
        pair = `${code}USD`; 
        isDirect = true;
    } else {
        pair = `USD${code}`;
        isDirect = false;
    }

    // TwelveData expects format "XXX/YYY" for forex pairs
    let querySymbol = pair;
    if (pair.length === 6) {
        querySymbol = `${pair.slice(0, 3)}/${pair.slice(3)}`;
    }

    try {
        const res = await fetch(`https://api.twelvedata.com/price?symbol=${querySymbol}&apikey=${apiKey}`);
        if (!res.ok) return null;
        
        const data = await res.json();
        
        if (data.status === 'error' || data.code) {
            console.warn(`FX fetch error for ${querySymbol}:`, data.message || 'Unknown API error');
            return null;
        }

        if (!data.price) {
            console.warn(`FX fetch error for ${querySymbol}:`, data.message || 'No price data');
            return null;
        }

        const price = parseFloat(data.price);
        if (isNaN(price) || price === 0) return null;

        // Calculate Rate: Multiplier to convert QuoteAmount to USD
        // If Direct (EURUSD = 1.10): 1 EUR = 1.10 USD. Multiplier is 1.10.
        // If Indirect (USDJPY = 150): 1 USD = 150 JPY -> 1 JPY = 1/150 USD. Multiplier is 1/150.
        const rate = isDirect ? price : (1 / price);

        // Cache result
        rateCache[code] = { rate, pair: querySymbol, timestamp: Date.now() };
        
        return { rate, pair: querySymbol };

    } catch (e) {
        console.error("FX Service Network Error", e);
        return null;
    }
};

/**
 * Returns the multiplier to convert 1 unit of quoteCurrency to USD.
 * e.g. for JPY returns ~0.0066 (1/150)
 */
export const getFxRateToUSD = async (quoteCurrency: string): Promise<number | null> => {
    const meta = await getFxMetaData(quoteCurrency);
    return meta ? meta.rate : null;
};

/**
 * Converts a specific amount of quote currency to USD.
 * Returns metadata about the conversion used.
 */
export const convertQuoteToUSD = async (amountQuote: number, quoteCurrency: string): Promise<{ amountQuote: number; amountUSD: number | null; rateUsed?: number; pairUsed?: string }> => {
    if (!quoteCurrency || quoteCurrency.toUpperCase() === 'USD') {
        return { amountQuote, amountUSD: amountQuote, rateUsed: 1, pairUsed: 'USD' };
    }

    const meta = await getFxMetaData(quoteCurrency);
    if (!meta) {
        return { amountQuote, amountUSD: null };
    }

    return {
        amountQuote,
        amountUSD: amountQuote * meta.rate,
        rateUsed: meta.rate,
        pairUsed: meta.pair
    };
};
