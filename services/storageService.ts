
import { Trade, Account, TagGroup, MonthlyNoteData, User } from '../types';

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

// --- Upload Service (Vercel Blob) ---

export const uploadImage = async (filename: string, base64Data: string): Promise<string> => {
    const response = await api<{ url: string }>('/upload', {
        method: 'POST',
        body: JSON.stringify({ filename, data: base64Data })
    });
    return response.url;
};

export const deleteBlobImages = async (urls: string[]): Promise<{ success: boolean; deleted: number }> => {
    return api<{ success: boolean; deleted: number }>('/blob/delete', {
        method: 'POST',
        body: JSON.stringify({ urls })
    });
};

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
        // If we requested for a specific user and got nothing, we might need to initialize (handled in UI)
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

export type BatchSaveResult = {
    success: boolean;
    updatedCount: number;
    updatedIds: string[];
};

export type BatchDeleteResult = {
    success: boolean;
    deletedCount: number;
};

export const getTrades = async (userId?: string, accountId?: string): Promise<Trade[]> => {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (accountId) params.append('accountId', accountId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api<Trade[]>(`/trades${query}`);
};

// Now returns a SINGLE trade object
export const saveTrade = async (trade: Trade, balanceChange?: number): Promise<Trade> => {
    return api<Trade>('/trades', {
        method: 'POST',
        body: JSON.stringify({ trade, balanceChange })
    });
};

// Batch update/import: returns a small summary to avoid wiping client state
export const saveTrades = async (newTrades: Trade[]): Promise<BatchSaveResult> => {
    return api<BatchSaveResult>('/trades/batch', {
        method: 'POST',
        body: JSON.stringify({ trades: newTrades })
    });
};

export const deleteTrade = async (id: string): Promise<{ success: boolean; id: string; deleted: boolean }> => {
    return api<{ success: boolean; id: string; deleted: boolean }>(`/trades/${id}`, { method: 'DELETE' });
};

export const deleteTrades = async (ids: string[]): Promise<BatchDeleteResult> => {
    // This is permanent delete
    return api<BatchDeleteResult>('/trades/batch', {
        method: 'DELETE',
        body: JSON.stringify({ ids })
    });
};

export const trashTrades = async (ids: string[], accountId?: string): Promise<Trade[]> => {
    return api<Trade[]>('/trades/trash', {
        method: 'POST',
        body: JSON.stringify({ ids, accountId })
    });
};

export const restoreTrades = async (ids: string[], accountId?: string): Promise<Trade[]> => {
    return api<Trade[]>('/trades/restore', {
        method: 'POST',
        body: JSON.stringify({ ids, accountId })
    });
};

// --- Tag Management ---

export const getTagGroups = async (userId?: string): Promise<TagGroup[]> => {
    try {
        const query = userId ? `?userId=${userId}` : '';
        const groups = await api<TagGroup[]>(`/tags${query}`);
        
        // If user specific tags are empty, return defaults
        if (!groups || groups.length === 0) {
            return DEFAULT_TAG_GROUPS;
        }
        return groups;
    } catch (e) {
        return DEFAULT_TAG_GROUPS;
    }
};

export const saveTagGroups = async (groups: TagGroup[], userId?: string): Promise<TagGroup[]> => {
    return api<TagGroup[]>('/tags', {
        method: 'POST',
        body: JSON.stringify({ groups, userId })
    });
};

// --- Strategy Management ---

export const getStrategies = async (userId?: string): Promise<string[]> => {
    try {
        const query = userId ? `?userId=${userId}` : '';
        const strategies = await api<string[]>(`/strategies${query}`);
        if (!strategies || strategies.length === 0) {
            return DEFAULT_STRATEGIES;
        }
        return strategies;
    } catch (e) {
        return DEFAULT_STRATEGIES;
    }
};

export const saveStrategies = async (strategies: string[], userId?: string): Promise<string[]> => {
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
