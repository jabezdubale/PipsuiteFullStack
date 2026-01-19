
export enum TradeType {
  LONG = 'LONG',
  SHORT = 'SHORT',
}

export enum TradeStatus {
  WIN = 'WIN',
  LOSS = 'LOSS',
  BREAK_EVEN = 'BREAK_EVEN',
  OPEN = 'OPEN',
  MISSED = 'MISSED'
}

export enum TradeOutcome {
  OPEN = 'Open',
  CLOSED = 'Closed',
  MISSED = 'Missed'
}

export enum OrderType {
  MARKET = 'Market',
  BUY_LIMIT = 'Buy Limit',
  SELL_LIMIT = 'Sell Limit',
  BUY_STOP = 'Buy Stop',
  SELL_STOP = 'Sell Stop'
}

export enum Session {
  SYDNEY = 'Sydney',
  TOKYO = 'Tokyo',
  LONDON = 'London',
  NEW_YORK = 'New York',
  NONE = '-'
}

export interface User {
  id: string;
  name: string;
  geminiApiKey: string;
  twelveDataApiKey: string;
}

export interface Account {
  id: string;
  userId: string; // Linked to User
  name: string;
  currency: string;
  balance: number;
  isDemo: boolean;
  type?: 'Real' | 'Demo' | 'Funded'; 
}

export interface TagGroup {
  name: string;
  tags: string[];
}

export interface MonthlyNoteData {
  goals: string;
  notes: string;
  review: string;
}

export interface TradePartial {
  id: string;
  quantity: number;
  pnl: number;
  price?: number; 
  date?: string;
}

export interface Trade {
  id: string;
  accountId: string; // Link to Account
  symbol: string;
  type: TradeType;
  
  // Dates & Times
  createdAt?: string; 
  entryDate: string; 
  entryTime?: string; 
  entrySession?: string; 
  exitDate?: string; 
  exitTime?: string; 
  exitSession?: string; 

  // Pricing
  entryPrice: number;
  exitPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  finalTakeProfit?: number; // TP at close
  finalStopLoss?: number;   // SL at close
  
  // Sizing & Risk
  leverage?: number;
  quantity: number;
  riskPercentage?: number;
  balance?: number; 
  
  // Execution
  orderType?: OrderType;
  outcome?: TradeOutcome; 

  // Financials
  fees: number;
  mainPnl?: number; 
  partials?: TradePartial[]; 
  pnl: number; 
  status: TradeStatus; 
  isBalanceUpdated?: boolean; 

  // Context
  setup: string;
  notes: string;
  emotionalNotes?: string;
  
  screenshots: string[]; 
  tags: string[];
  
  // Trash / Soft Delete functionality
  isDeleted?: boolean;
  deletedAt?: string;

  // Stored Conversions & Metrics
  quoteCurrency?: string | null;
  fxRateToUsd?: number | null;
  plannedRiskQuote?: number | null;
  plannedRewardQuote?: number | null;
  plannedRiskUsd?: number | null;
  plannedRewardUsd?: number | null;
}

export interface TradeStats {
  totalTrades: number;
  winRate: number;
  netPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
}

// Columns available for the Table View
export type ColumnKey = keyof Trade | 'slFilled' | 'tpFilled' | 'rr' | 'plannedReward' | 'partialsCount' | 'partialProfit' | 'screenshotsCount';

export const AVAILABLE_COLUMNS: { key: ColumnKey; label: string }[] = [
  // Symbol is now fixed, removed from optional list
  { key: 'createdAt', label: 'Log Time' },
  { key: 'type', label: 'Direction' },
  { key: 'entryPrice', label: 'Entry Price' },
  { key: 'entryTime', label: 'Entry Time' },
  { key: 'entrySession', label: 'Entry Session' },
  { key: 'exitPrice', label: 'Exit Price' },
  { key: 'exitTime', label: 'Exit Time' },
  { key: 'exitSession', label: 'Exit Session' },
  { key: 'stopLoss', label: 'Entry SL' },
  { key: 'takeProfit', label: 'Entry TP' },
  { key: 'finalStopLoss', label: 'Final SL' },
  { key: 'finalTakeProfit', label: 'Final TP' },
  { key: 'slFilled', label: 'Stop Loss Filled' },
  { key: 'tpFilled', label: 'Take Profit Filled' },
  { key: 'quantity', label: 'Lot Size' },
  { key: 'rr', label: 'RR Ratio' },
  { key: 'plannedReward', label: 'Planned Reward' },
  { key: 'outcome', label: 'Outcome' },
  { key: 'orderType', label: 'Order Type' },
  { key: 'setup', label: 'Strategy' },
  { key: 'partialsCount', label: 'Partials' },
  { key: 'partialProfit', label: 'Partial Profits' },
  { key: 'mainPnl', label: 'Core P&L' },
  { key: 'fees', label: 'Fees' },
  { key: 'pnl', label: 'Net P&L' },
  { key: 'notes', label: 'Technical Notes' },
  { key: 'emotionalNotes', label: 'Emotional Notes' },
  { key: 'tags', label: 'Tags' },
  { key: 'screenshotsCount', label: 'Screenshots' },
];

export interface Asset {
  id: string;
  assetPair: string;
  contractSize: number;
  pip: number;
  tick: number;
  base: string;
  quote: string;
}

export const ASSETS: Asset[] = [
  {
    "id": "1",
    "assetPair": "XAUUSD",
    "contractSize": 100,
    "pip": 0.1,
    "tick": 0.01,
    "base": "XAU",
    "quote": "USD"
  },
  {
    "id": "2",
    "assetPair": "EURUSD",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "EUR",
    "quote": "USD"
  },
  {
    "id": "3",
    "assetPair": "USDJPY",
    "contractSize": 100000,
    "pip": 0.01,
    "tick": 0.001,
    "base": "USD",
    "quote": "JPY"
  },
  {
    "id": "4",
    "assetPair": "GBPUSD",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "GBP",
    "quote": "USD"
  },
  {
    "id": "5",
    "assetPair": "AUDUSD",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "AUD",
    "quote": "USD"
  },
  {
    "id": "6",
    "assetPair": "NZDUSD",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "NZD",
    "quote": "USD"
  },
  {
    "id": "7",
    "assetPair": "USDCAD",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "USD",
    "quote": "CAD"
  },
  {
    "id": "8",
    "assetPair": "USDCHF",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "USD",
    "quote": "CHF"
  },
  {
    "id": "9",
    "assetPair": "EURJPY",
    "contractSize": 100000,
    "pip": 0.01,
    "tick": 0.001,
    "base": "EUR",
    "quote": "JPY"
  },
  {
    "id": "10",
    "assetPair": "GBPJPY",
    "contractSize": 100000,
    "pip": 0.01,
    "tick": 0.001,
    "base": "GBP",
    "quote": "JPY"
  },
  {
    "id": "11",
    "assetPair": "EURAUD",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "EUR",
    "quote": "AUD"
  },
  {
    "id": "12",
    "assetPair": "EURGBP",
    "contractSize": 100000,
    "pip": 0.0001,
    "tick": 0.00001,
    "base": "EUR",
    "quote": "GBP"
  },
  {
    "id": "13",
    "assetPair": "AUDJPY",
    "contractSize": 100000,
    "pip": 0.01,
    "tick": 0.001,
    "base": "AUD",
    "quote": "JPY"
  },
  {
    "id": "14",
    "assetPair": "CADJPY",
    "contractSize": 100000,
    "pip": 0.01,
    "tick": 0.001,
    "base": "CAD",
    "quote": "JPY"
  },
  {
    "id": "15",
    "assetPair": "CHFJPY",
    "contractSize": 100000,
    "pip": 0.01,
    "tick": 0.001,
    "base": "CHF",
    "quote": "JPY"
  },
  {
    "id": "16",
    "assetPair": "USOIL",
    "contractSize": 1000,
    "pip": 0.01,
    "tick": 0.01,
    "base": "USOIL",
    "quote": "USD"
  },
  {
    "id": "17",
    "assetPair": "UKOIL",
    "contractSize": 1000,
    "pip": 0.01,
    "tick": 0.01,
    "base": "UKOIL",
    "quote": "USD"
  },
  {
    "id": "18",
    "assetPair": "XAGUSD",
    "contractSize": 5000,
    "pip": 0.01,
    "tick": 0.001,
    "base": "XAG",
    "quote": "USD"
  },
  {
    "id": "19",
    "assetPair": "BTCUSD",
    "contractSize": 1,
    "pip": 0.01,
    "tick": 0.01,
    "base": "BTC",
    "quote": "USD"
  },
  {
    "id": "20",
    "assetPair": "ETHUSD",
    "contractSize": 1,
    "pip": 0.01,
    "tick": 0.01,
    "base": "ETH",
    "quote": "USD"
  },
  {
    "id": "21",
    "assetPair": "XRPUSD",
    "contractSize": 1,
    "pip": 0.0001,
    "tick": 0.0001,
    "base": "XRP",
    "quote": "USD"
  },
  {
    "id": "22",
    "assetPair": "LTCUSD",
    "contractSize": 1,
    "pip": 0.01,
    "tick": 0.01,
    "base": "LTC",
    "quote": "USD"
  },
  {
    "id": "23",
    "assetPair": "ADAUSD",
    "contractSize": 1,
    "pip": 0.0001,
    "tick": 0.0001,
    "base": "ADA",
    "quote": "USD"
  },
  {
    "id": "24",
    "assetPair": "SOLUSD",
    "contractSize": 1,
    "pip": 0.01,
    "tick": 0.01,
    "base": "SOL",
    "quote": "USD"
  },
  {
    "id": "25",
    "assetPair": "BNBUSD",
    "contractSize": 1,
    "pip": 0.01,
    "tick": 0.01,
    "base": "BNB",
    "quote": "USD"
  },
  {
    "id": "26",
    "assetPair": "US30",
    "contractSize": 1,
    "pip": 1,
    "tick": 0.1,
    "base": "US30",
    "quote": "USD"
  },
  {
    "id": "27",
    "assetPair": "NAS100",
    "contractSize": 1,
    "pip": 0.1,
    "tick": 0.01,
    "base": "NAS100",
    "quote": "USD"
  },
  {
    "id": "28",
    "assetPair": "SPX500",
    "contractSize": 1,
    "pip": 0.1,
    "tick": 0.01,
    "base": "SPX500",
    "quote": "USD"
  },
  {
    "id": "29",
    "assetPair": "GER30",
    "contractSize": 1,
    "pip": 0.1,
    "tick": 0.01,
    "base": "GER30",
    "quote": "EUR"
  },
  {
    "id": "30",
    "assetPair": "UK100",
    "contractSize": 1,
    "pip": 0.1,
    "tick": 0.01,
    "base": "UK100",
    "quote": "GBP"
  },
  {
    "id": "31",
    "assetPair": "JP225",
    "contractSize": 1,
    "pip": 1,
    "tick": 0.1,
    "base": "JP225",
    "quote": "JPY"
  }
];
