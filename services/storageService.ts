
import { Trade, Account, TagGroup, MonthlyNoteData, User } from '../types';

const API_BASE = '/api';

// In-Memory Cache for static data
const CACHE: {
    tagGroups: Record<string, TagGroup[]> | null;
    strategies: Record<string, string[]> | null;
} = {
    tagGroups: null,
    strategies: null
};

// --- Helper for fetch with Retry ---
const fetchWithRetry = async (url: string, options?: RequestInit, retries = 3, backoff = 500): Promise<Response> => {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            // Throw to trigger catch block for 5xx errors or if we want to retry on 429 etc.
            // For 4xx client errors (except maybe 429), we usually don't want to retry.
            if (response.status >= 500 || response.status === 429) {
                throw new Error(response.statusText);
            }
        }
        return response;
    } catch (err) {
        if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
};

const api = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }
    
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch (e) {
        console.error("Invalid JSON response:", text);
        throw new Error("Server returned invalid data format.");
    }
};

const DEFAULT_ACCOUNTS: Account[] = [{
    id: 'default_1',
    userId: 'start_user',
    name: 'Main Account',
    currency: 'USD',
    balance: 10000,
    isDemo: false,
    type: 'Real'
}];

const DEFAULT_TAG_GROUPS: TagGroup[] = [
  {
    name: 'Technical',
    tags: ['#BOS', '#CHoCH', '#OB', '#FVG', '#Liquidity-Sweep', '#POI-Entry', '#Inducement', '#Premium', '#Discount', '#Stop-Hunt', '#Mitigation', '#Eq-Highs', '#Eq-Lows']
  },
  {
    name: 'Execution',
    tags: ['#Break-Even', '#Partial', '#Early-Exit', '#Late-Chased', '#News-Vol', '#Manual-Close', '#Trailing', '#TP', '#SL']
  },
  {
    name: 'Emotional',
    tags: ['#FOMO', '#Revenge', '#Greed', '#Hesitation', '#Hope', '#Boredom', '#Over-Confidence', '#Impulsive', '#Disciplined', '#Anxious', '#Distracted']
  },
  {
    name: 'Risk Management',
    tags: ['#Fixed-Risk', '#Wrong-Risk', '#BE-Aggressive', '#BE-Passive', '#Over-Leveraged', '#Multiple-Risk', '#Max-Drawdown', '#Daily-Drawdown', '#Recovery-Risk']
  }
];

const DEFAULT_STRATEGIES: string[] = [
    'SMC',
    'Price-Action',
    'Supply-Demand',
    'Trend-Following',
    'Break-Retest',
    'News-Trading',
    'Range-Trading',
    'Scalping',
    'Order-Flow',
    'Gap-Fill'
];

// --- Generic Settings ---

export const getSetting = async <T>(key: string, defaultVal: T): Promise<T> => {
    try {
        const val = await api<T>(`/settings/${key}`);
        return val !== null ? val : defaultVal;
    } catch (e) {
        console.warn(`Failed to fetch setting ${key}, using default.`);
        return defaultVal;
    }
};

export const saveSetting = async (key: string, value: any): Promise<void> => {
    await api('/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value })
    });
};

// --- User Management ---

export const getUsers = async (): Promise<User[]> => {
    return api<User[]>('/users');
};

export const saveUser = async (user: User): Promise<User[]> => {
    return api<User[]>('/users', {
        method: 'POST',
        body: JSON.stringify(user)
    });
};

export const deleteUser = async (id: string): Promise<User[]> => {
    return api<User[]>(`/users/${id}`, { method: 'DELETE' });
};

// --- Account Management ---

export const getAccounts = async (userId?: string): Promise<Account[]> => {
    try {
        const query = userId ? `?userId=${userId}` : '';
        const accounts = await api<Account[]>(`/accounts${query}`);
        return accounts || [];
    } catch (e) {
        console.error("Failed to fetch accounts", e);
        return [];
    }
};

export const saveAccount = async (account: Account): Promise<Account[]> => {
    return api<Account[]>('/accounts', {
        method: 'POST',
        body: JSON.stringify(account)
    });
};

export const adjustAccountBalance = async (accountId: string, amount: number): Promise<Account[]> => {
    return api<Account[]>(`/accounts/${accountId}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ amount })
    });
};

export const deleteAccount = async (accountId: string): Promise<void> => {
    await api(`/accounts/${accountId}`, { method: 'DELETE' });
};

// --- Trade Management ---

export const getTrades = async (userId?: string): Promise<Trade[]> => {
    const query = userId ? `?userId=${userId}` : '';
    return api<Trade[]>(`/trades${query}`);
};

export const saveTrade = async (trade: Trade): Promise<Trade[]> => {
    return api<Trade[]>('/trades', {
        method: 'POST',
        body: JSON.stringify(trade)
    });
};

// Atomic Close Transaction
export const closeTrade = async (trade: Trade, affectBalance: boolean): Promise<Trade[]> => {
    return await api<Trade[]>(`/trades/${trade.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ trade, affectBalance })
    });
};

export const saveTrades = async (newTrades: Trade[]): Promise<Trade[]> => {
    return api<Trade[]>('/trades/batch', {
        method: 'POST',
        body: JSON.stringify({ trades: newTrades })
    });
};

export const deleteTrade = async (id: string): Promise<Trade[]> => {
    return api<Trade[]>(`/trades/${id}`, { method: 'DELETE' });
};

export const deleteTrades = async (ids: string[]): Promise<Trade[]> => {
    return api<Trade[]>('/trades/batch', {
        method: 'DELETE',
        body: JSON.stringify({ ids })
    });
};

// --- Tag Management ---

export const getTagGroups = async (userId?: string): Promise<TagGroup[]> => {
    const cacheKey = userId || 'global';
    
    // Check Cache
    if (CACHE.tagGroups && CACHE.tagGroups[cacheKey]) {
        return CACHE.tagGroups[cacheKey];
    }

    try {
        const query = userId ? `?userId=${userId}` : '';
        const groups = await api<TagGroup[]>(`/tags${query}`);
        const finalGroups = (!groups || groups.length === 0) ? DEFAULT_TAG_GROUPS : groups;
        
        // Update Cache
        if (!CACHE.tagGroups) CACHE.tagGroups = {};
        CACHE.tagGroups[cacheKey] = finalGroups;
        
        return finalGroups;
    } catch (e) {
        return DEFAULT_TAG_GROUPS;
    }
};

export const saveTagGroups = async (groups: TagGroup[], userId?: string): Promise<TagGroup[]> => {
    const cacheKey = userId || 'global';
    
    // Optimistic Cache Update
    if (!CACHE.tagGroups) CACHE.tagGroups = {};
    CACHE.tagGroups[cacheKey] = groups;

    return api<TagGroup[]>('/tags', {
        method: 'POST',
        body: JSON.stringify({ groups, userId })
    });
};

// --- Strategy Management ---

export const getStrategies = async (userId?: string): Promise<string[]> => {
    const cacheKey = userId || 'global';

    // Check Cache
    if (CACHE.strategies && CACHE.strategies[cacheKey]) {
        return CACHE.strategies[cacheKey];
    }

    try {
        const query = userId ? `?userId=${userId}` : '';
        const strategies = await api<string[]>(`/strategies${query}`);
        const finalStrategies = (!strategies || strategies.length === 0) ? DEFAULT_STRATEGIES : strategies;
        
        // Update Cache
        if (!CACHE.strategies) CACHE.strategies = {};
        CACHE.strategies[cacheKey] = finalStrategies;

        return finalStrategies;
    } catch (e) {
        return DEFAULT_STRATEGIES;
    }
};

export const saveStrategies = async (strategies: string[], userId?: string): Promise<string[]> => {
    const cacheKey = userId || 'global';

    // Optimistic Cache Update
    if (!CACHE.strategies) CACHE.strategies = {};
    CACHE.strategies[cacheKey] = strategies;

    return api<string[]>('/strategies', {
        method: 'POST',
        body: JSON.stringify({ strategies, userId })
    });
};

// --- Monthly Notes ---

export const getMonthlyNote = async (monthKey: string): Promise<MonthlyNoteData> => {
    const data = await api<any>(`/monthly-notes/${monthKey}`);
    return {
        goals: data?.goals || '',
        notes: data?.notes || '',
        review: data?.review || ''
    };
};

export const saveMonthlyNote = async (monthKey: string, data: MonthlyNoteData): Promise<void> => {
    await api('/monthly-notes', {
        method: 'POST',
        body: JSON.stringify({ monthKey, data })
    });
};
