
import { Trade, Account, TagGroup, MonthlyNoteData } from '../types';

const API_BASE = '/api';

// --- Helper for fetch ---
const api = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }
    // Handle specific case where generic settings endpoint returns null
    const text = await response.text();
    return text ? JSON.parse(text) : null;
};

const DEFAULT_ACCOUNTS: Account[] = [{
    id: 'default_1',
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

// --- Generic Settings (Theme, Columns, User Profile) ---

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

// --- Account Management ---

export const getAccounts = async (): Promise<Account[]> => {
    try {
        const accounts = await api<Account[]>('/accounts');
        if (!accounts || accounts.length === 0) {
            // Initialize defaults in DB if empty
            await api('/accounts', { method: 'POST', body: JSON.stringify(DEFAULT_ACCOUNTS[0]) });
            return DEFAULT_ACCOUNTS;
        }
        return accounts;
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

export const deleteAccount = async (accountId: string): Promise<void> => {
    await api(`/accounts/${accountId}`, { method: 'DELETE' });
};

// --- Trade Management ---

export const getTrades = async (): Promise<Trade[]> => {
    return api<Trade[]>('/trades');
};

export const saveTrade = async (trade: Trade): Promise<Trade[]> => {
    return api<Trade[]>('/trades', {
        method: 'POST',
        body: JSON.stringify(trade)
    });
};

export const saveTrades = async (newTrades: Trade[]): Promise<Trade[]> => {
    // Uses the batch import endpoint for efficiency and reliability
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

export const getTagGroups = async (): Promise<TagGroup[]> => {
    try {
        const groups = await api<TagGroup[]>('/tags');
        if (!groups || groups.length === 0) {
            await saveTagGroups(DEFAULT_TAG_GROUPS);
            return DEFAULT_TAG_GROUPS;
        }
        return groups;
    } catch (e) {
        return DEFAULT_TAG_GROUPS;
    }
};

export const saveTagGroups = async (groups: TagGroup[]): Promise<TagGroup[]> => {
    return api<TagGroup[]>('/tags', {
        method: 'POST',
        body: JSON.stringify(groups)
    });
};

// --- Strategy Management ---

export const getStrategies = async (): Promise<string[]> => {
    try {
        const strategies = await api<string[]>('/strategies');
        if (!strategies || strategies.length === 0) {
            await saveStrategies(DEFAULT_STRATEGIES);
            return DEFAULT_STRATEGIES;
        }
        return strategies;
    } catch (e) {
        return DEFAULT_STRATEGIES;
    }
};

export const saveStrategies = async (strategies: string[]): Promise<string[]> => {
    return api<string[]>('/strategies', {
        method: 'POST',
        body: JSON.stringify(strategies)
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
