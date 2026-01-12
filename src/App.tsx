
import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAccounts, saveAccount, deleteAccount, 
  getTrades, saveTrade, deleteTrade, saveTrades, deleteTrades,
  getTagGroups, saveTagGroups, 
  getStrategies, saveStrategies,
  getSetting, saveSetting
} from './services/storageService';
import { Trade, Account, TagGroup, TradeType, TradeStatus, TradeOutcome, OrderType, Session, ASSETS, User } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TradeList from './components/TradeList';
import CalendarView from './components/CalendarView';
import TradeDetail from './components/TradeDetail';
import TradeViewModal from './components/TradeViewModal';
import TagManager from './components/TagManager';
import StrategyManager from './components/StrategyManager';
import AddAccountModal from './components/AddAccountModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import DeleteAccountModal from './components/DeleteAccountModal';
import DailyViewModal from './components/DailyViewModal';
import AICoach from './components/AICoach';
import UserModal from './components/UserModal';
import { Eraser, X, Plus, Calculator, TrendingUp, TrendingDown } from 'lucide-react';
import { calculateAutoTags } from './utils/autoTagLogic';
import { getSessionForTime } from './utils/sessionHelpers';

const AddTradeSidePanel = ({ 
  isOpen, 
  onClose, 
  accounts, 
  selectedAccountId, 
  strategies, 
  onSave 
}: {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  selectedAccountId: string;
  strategies: string[];
  onSave: (trade: Trade) => void;
}) => {
  const [formData, setFormData] = useState({
    accountId: selectedAccountId || '',
    symbol: 'XAUUSD',
    type: TradeType.LONG,
    entryPrice: '',
    entryDate: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
    quantity: '',
    stopLoss: '',
    takeProfit: '',
    setup: '',
    notes: '',
    balance: '' // For risk calc
  });

  useEffect(() => {
    if (isOpen) {
        const defaultAccId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : '');
        const acc = accounts.find(a => a.id === defaultAccId);
        setFormData(prev => ({
            ...prev,
            accountId: defaultAccId,
            balance: acc ? acc.balance.toString() : ''
        }));
    }
  }, [isOpen, selectedAccountId, accounts]);

  const handleChange = (field: string, value: any) => {
      setFormData(prev => {
          const updates = { ...prev, [field]: value };
          // Auto-update balance if account changes
          if (field === 'accountId') {
              const acc = accounts.find(a => a.id === value);
              if (acc) updates.balance = acc.balance.toString();
          }
          return updates;
      });
  };

  const handleClearForm = () => {
      const defaultAccId = selectedAccountId || (accounts.length > 0 ? accounts[0].id : '');
      const acc = accounts.find(a => a.id === defaultAccId);
      setFormData({
        accountId: defaultAccId,
        symbol: 'XAUUSD',
        type: TradeType.LONG,
        entryPrice: '',
        entryDate: new Date().toISOString().slice(0, 16),
        quantity: '',
        stopLoss: '',
        takeProfit: '',
        setup: '',
        notes: '',
        balance: acc ? acc.balance.toString() : ''
      });
  };

  // --- Calculations ---
  const calculations = useMemo(() => {
      const { symbol, entryPrice, stopLoss, takeProfit, quantity, type } = formData;
      const asset = ASSETS.find(a => a.assetPair === symbol);
      
      const entry = parseFloat(entryPrice);
      const qty = parseFloat(quantity);
      const sl = parseFloat(stopLoss);
      const tp = parseFloat(takeProfit);

      if (!asset || isNaN(entry) || isNaN(qty)) return null;

      let riskAmount = 0;
      let rewardAmount = 0;
      let rr = 0;

      // Risk
      if (!isNaN(sl)) {
          const riskDist = Math.abs(entry - sl);
          riskAmount = riskDist * asset.contractSize * qty;
      }

      // Reward
      if (!isNaN(tp)) {
          const rewardDist = Math.abs(tp - entry);
          rewardAmount = rewardDist * asset.contractSize * qty;
      }

      // RR
      if (riskAmount > 0 && rewardAmount > 0) {
          rr = rewardAmount / riskAmount;
      }
      
      return { riskAmount, rewardAmount, rr, asset };
  }, [formData]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.entryPrice || !formData.quantity || !formData.accountId) {
          alert("Please fill in Entry Price, Lot Size, and select an Account.");
          return;
      }

      const entryDateObj = new Date(formData.entryDate);
      const entryTime = entryDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const entrySession = getSessionForTime(entryDateObj);

      const tags = calculateAutoTags({
          tags: [],
          type: formData.type,
          entryPrice: parseFloat(formData.entryPrice),
          takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
          stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined
      });

      const newTrade: Trade = {
          id: `trade_${Date.now()}`,
          accountId: formData.accountId,
          symbol: formData.symbol,
          type: formData.type,
          status: TradeStatus.OPEN,
          outcome: TradeOutcome.OPEN,
          entryPrice: parseFloat(formData.entryPrice) || 0, // Ensure valid number
          entryDate: entryDateObj.toISOString(),
          entryTime,
          entrySession,
          quantity: parseFloat(formData.quantity) || 0, // Ensure valid number
          stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
          takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
          setup: formData.setup,
          notes: formData.notes,
          tags: tags,
          pnl: 0,
          fees: 0,
          screenshots: [],
          createdAt: new Date().toISOString()
      };

      onSave(newTrade);
      handleClearForm();
      onClose();
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
          
          {/* Panel */}
          <div className="relative w-full max-w-md bg-surface shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
              <div className="p-4 border-b border-border flex justify-between items-center bg-surfaceHighlight/30">
                  <h3 className="font-bold text-lg">Add New Trade</h3>
                  <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-textMuted hover:text-textMain">
                      <X size={20} />
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5">
                  <form id="add-trade-form" onSubmit={handleSubmit} className="space-y-5">
                      {/* Asset & Direction */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-medium text-textMuted mb-1">Asset Pair</label>
                              <select 
                                value={formData.symbol}
                                onChange={(e) => handleChange('symbol', e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                              >
                                  {ASSETS.map(a => <option key={a.id} value={a.assetPair}>{a.assetPair}</option>)}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-textMuted mb-1">Direction</label>
                              <div className="flex bg-surfaceHighlight rounded p-1">
                                  <button
                                    type="button"
                                    onClick={() => handleChange('type', TradeType.LONG)}
                                    className={`flex-1 text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${formData.type === TradeType.LONG ? 'bg-profit text-white shadow' : 'text-textMuted hover:text-textMain'}`}
                                  >
                                      <TrendingUp size={14} /> LONG
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleChange('type', TradeType.SHORT)}
                                    className={`flex-1 text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${formData.type === TradeType.SHORT ? 'bg-loss text-white shadow' : 'text-textMuted hover:text-textMain'}`}
                                  >
                                      <TrendingDown size={14} /> SHORT
                                  </button>
                              </div>
                          </div>
                      </div>

                      {/* Entry & Size */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-medium text-textMuted mb-1">Entry Price</label>
                              <input 
                                type="number" 
                                step="any"
                                value={formData.entryPrice}
                                onChange={(e) => handleChange('entryPrice', e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                required
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-textMuted mb-1">Lot Size</label>
                              <input 
                                type="number" 
                                step="any"
                                value={formData.quantity}
                                onChange={(e) => handleChange('quantity', e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                required
                              />
                          </div>
                      </div>

                      {/* Calculation Preview Box */}
                      {calculations && (
                          <div className="bg-surfaceHighlight/50 border border-border rounded-lg p-3 text-xs space-y-2">
                              <div className="flex justify-between items-center">
                                  <span className="text-textMuted font-bold uppercase flex items-center gap-1"><Calculator size={10} /> Estimates</span>
                                  {calculations.rr > 0 && (
                                      <span className="text-primary font-bold">1:{calculations.rr.toFixed(2)} RR</span>
                                  )}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-background/50 p-2 rounded border border-border/50">
                                      <span className="text-[10px] text-textMuted uppercase block">Risk</span>
                                      <span className="font-mono font-bold text-loss">-${calculations.riskAmount.toFixed(2)}</span>
                                  </div>
                                  <div className="bg-background/50 p-2 rounded border border-border/50">
                                      <span className="text-[10px] text-textMuted uppercase block">Reward</span>
                                      <span className="font-mono font-bold text-profit">+${calculations.rewardAmount.toFixed(2)}</span>
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* Time */}
                      <div>
                          <label className="block text-xs font-medium text-textMuted mb-1">Date & Time</label>
                          <input 
                            type="datetime-local" 
                            value={formData.entryDate}
                            onChange={(e) => handleChange('entryDate', e.target.value)}
                            className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                            required
                          />
                      </div>

                      {/* Risk Management */}
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-medium text-textMuted mb-1">Stop Loss</label>
                              <input 
                                type="number" 
                                step="any"
                                value={formData.stopLoss}
                                onChange={(e) => handleChange('stopLoss', e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                placeholder="Optional"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-medium text-textMuted mb-1">Take Profit</label>
                              <input 
                                type="number" 
                                step="any"
                                value={formData.takeProfit}
                                onChange={(e) => handleChange('takeProfit', e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                                placeholder="Optional"
                              />
                          </div>
                      </div>

                      {/* Details */}
                      <div>
                          <label className="block text-xs font-medium text-textMuted mb-1">Strategy</label>
                          <select 
                                value={formData.setup}
                                onChange={(e) => handleChange('setup', e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                              >
                                  <option value="">Select Strategy</option>
                                  {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                      </div>

                      <div>
                          <label className="block text-xs font-medium text-textMuted mb-1">Notes</label>
                          <textarea 
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none resize-none h-24"
                            placeholder="Why did you take this trade?"
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-medium text-textMuted mb-1">Account</label>
                          <select 
                            value={formData.accountId}
                            onChange={(e) => handleChange('accountId', e.target.value)}
                            className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                            required
                          >
                              {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (${a.balance})</option>)}
                          </select>
                      </div>
                  </form>
              </div>

              <div className="p-4 border-t border-border flex gap-3 shrink-0 bg-surface rounded-b-xl relative">
                  {accounts.length === 0 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                          <span className="bg-loss text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                              No Account Found
                          </span>
                      </div>
                  )}
                  <button
                      type="button"
                      onClick={handleClearForm}
                      className="px-4 py-2 bg-surface border border-border hover:bg-surfaceHighlight text-textMuted hover:text-textMain rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                      title="Clear Form"
                  >
                      <Eraser size={16} />
                  </button>
                  <button 
                      type="submit" 
                      form="add-trade-form"
                      disabled={accounts.length === 0}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${
                          accounts.length === 0 
                          ? 'bg-surfaceHighlight text-textMuted cursor-not-allowed opacity-50 blur-[1px]' 
                          : 'bg-primary hover:bg-blue-600 text-white'
                      }`}
                  >
                      Save Trade
                  </button>
            </div>
          </div>
      </div>
  );
};

function App() {
  // --- STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  
  // UI State - initialized to defaults, then updated from DB
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  const [dailyViewDate, setDailyViewDate] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  
  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Date Range (Global Filter) - Default to this month
  const [startDate, setStartDate] = useState(() => {
     const now = new Date();
     return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
     const now = new Date();
     return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // --- EFFECTS ---

  useEffect(() => {
    const initData = async () => {
      // 1. Theme & User (Sync from DB)
      const themePref = await getSetting<string>('pipsuite_theme', 'light');
      setIsDarkMode(themePref === 'dark');
      
      const userProfile = await getSetting<User | null>('pipsuite_user', null);
      setUser(userProfile);

      // 2. Data
      const accs = await getAccounts();
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccountId(accs[0].id);

      const trds = await getTrades();
      setTrades(trds);

      const tgs = await getTagGroups();
      setTagGroups(tgs);

      const strats = await getStrategies();
      setStrategies(strats);
    };
    initData();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
      const newTheme = !isDarkMode ? 'dark' : 'light';
      setIsDarkMode(!isDarkMode);
      saveSetting('pipsuite_theme', newTheme);
  };

  // --- COMPUTED ---
  const currentAccountTrades = useMemo(() => {
      if (!selectedAccountId) return [];
      return trades.filter(t => t.accountId === selectedAccountId && !t.isDeleted);
  }, [trades, selectedAccountId]);
  
  const trashTrades = useMemo(() => {
    if (!selectedAccountId) return [];
    return trades.filter(t => t.accountId === selectedAccountId && t.isDeleted);
  }, [trades, selectedAccountId]);

  const stats = useMemo(() => {
      const wins = currentAccountTrades.filter(t => t.pnl > 0);
      const losses = currentAccountTrades.filter(t => t.pnl < 0);
      const totalTrades = currentAccountTrades.length;
      
      const netPnL = currentAccountTrades.reduce((acc, t) => acc + t.pnl, 0);
      const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;
      const totalWon = wins.reduce((acc, t) => acc + t.pnl, 0);
      const totalLost = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));
      const profitFactor = totalLost === 0 ? totalWon : totalWon / totalLost;
      
      return {
          totalTrades,
          winRate,
          netPnL,
          avgWin: wins.length > 0 ? totalWon / wins.length : 0,
          avgLoss: losses.length > 0 ? totalLost / losses.length : 0,
          profitFactor,
          bestTrade: Math.max(...currentAccountTrades.map(t => t.pnl), 0),
          worstTrade: Math.min(...currentAccountTrades.map(t => t.pnl), 0)
      };
  }, [currentAccountTrades]);

  // --- HANDLERS ---

  const handleSaveTrade = async (trade: Trade, shouldClose: boolean = true) => {
    try {
        let updatedTrades: Trade[];
        const exists = trades.find(t => t.id === trade.id);
        
        if (exists) {
            updatedTrades = await saveTrade(trade);
        } else {
            updatedTrades = await saveTrade(trade);
        }
        setTrades(updatedTrades);

        if (shouldClose) {
            setEditingTrade(null);
            setViewingTrade(null);
            setShowAddTrade(false);
        }
    } catch (e: any) {
        // Log detailed error and alert user
        console.error("Failed to save trade:", e);
        // Attempt to parse API error message if available
        const errorMsg = e.message || "Unknown error";
        alert(`Failed to save trade. Server response: ${errorMsg}`);
    }
  };

  const handleSoftDeleteTrade = async (id: string) => {
    const trade = trades.find(t => t.id === id);
    if (trade) {
       await saveTrade({ ...trade, isDeleted: true, deletedAt: new Date().toISOString() });
       const updated = await getTrades();
       setTrades(updated);
       
       // Revert balance if deleted trade had affected balance
       if (trade.isBalanceUpdated && trade.outcome === TradeOutcome.CLOSED) {
          handleUpdateBalance(Math.abs(trade.pnl), trade.pnl >= 0 ? 'withdraw' : 'deposit');
       }
    }
    setViewingTrade(null);
    setEditingTrade(null);
  };

  const handlePermanentDeleteTrade = async (id: string) => {
      await deleteTrade(id);
      setTrades(await getTrades());
  };
  
  const handleRestoreTrades = async (ids: string[]) => {
      const allTrades = await getTrades();
      const updated = allTrades.map(t => ids.includes(t.id) ? { ...t, isDeleted: false, deletedAt: undefined } : t);
      for (const t of updated) {
          if (ids.includes(t.id)) await saveTrade(t);
      }
      setTrades(await getTrades());
  };

  const handleAddAccount = async (account: Account) => {
      const updated = await saveAccount(account);
      setAccounts(updated);
      setSelectedAccountId(account.id);
  };

  const handleDeleteAccount = async () => {
      if (!accountToDelete) return;
      await deleteAccount(accountToDelete.id);
      const updated = await getAccounts();
      setAccounts(updated);
      if (updated.length > 0) setSelectedAccountId(updated[0].id);
      else setSelectedAccountId('');
      setAccountToDelete(null);
  };

  const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw') => {
      const account = accounts.find(a => a.id === selectedAccountId);
      if (!account) return;

      const newBalance = type === 'deposit' ? account.balance + amount : account.balance - amount;
      const updatedAccount = { ...account, balance: newBalance };
      await saveAccount(updatedAccount);
      setAccounts(await getAccounts());
  };

  const handleImportTrades = async (importedTrades: Trade[]) => {
      const newTrades = await saveTrades(importedTrades);
      setTrades(newTrades);
  };

  const handleUserUpdate = (userData: Partial<User>) => {
      const updatedUser = { ...user, ...userData, id: user?.id || 'u1' } as User;
      setUser(updatedUser);
      saveSetting('pipsuite_user', updatedUser);
  };

  // --- RENDER ---

  if (editingTrade) {
      return (
          <TradeDetail 
            trade={editingTrade}
            accounts={accounts}
            tagGroups={tagGroups}
            strategies={strategies}
            onSave={handleSaveTrade}
            onDelete={handleSoftDeleteTrade}
            onBack={() => setEditingTrade(null)}
            onUpdateBalance={handleUpdateBalance}
          />
      );
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      accounts={accounts}
      selectedAccountId={selectedAccountId}
      setSelectedAccountId={setSelectedAccountId}
      onAddTradeClick={() => setShowAddTrade(true)}
      startDate={startDate}
      setStartDate={setStartDate}
      endDate={endDate}
      setEndDate={setEndDate}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
      onUpdateBalance={handleUpdateBalance}
    >
      {/* Content Switcher */}
      {activeTab === 'dashboard' && (
          <div className="space-y-6">
              <Dashboard 
                stats={stats} 
                trades={currentAccountTrades} 
                tagGroups={tagGroups} 
              />
              <AICoach trades={currentAccountTrades} />
          </div>
      )}

      {activeTab === 'journal' && (
          <TradeList 
            trades={currentAccountTrades}
            selectedAccountId={selectedAccountId}
            onTradeClick={(t) => setViewingTrade(t)}
            onDeleteTrade={handleSoftDeleteTrade}
            onImportTrades={handleImportTrades}
            tagGroups={tagGroups}
          />
      )}

      {activeTab === 'calendar' && (
          <CalendarView 
             trades={currentAccountTrades}
             currentMonth={currentMonth}
             setCurrentMonth={setCurrentMonth}
             onDayClick={(date, dayTrades) => setDailyViewDate(date)}
          />
      )}

      {activeTab === 'trash' && (
           <TradeList 
            trades={trashTrades}
            selectedAccountId={selectedAccountId}
            onTradeClick={(t) => setViewingTrade(t)}
            onDeleteTrade={handlePermanentDeleteTrade}
            onDeleteTrades={(ids) => ids.forEach(id => handlePermanentDeleteTrade(id))}
            onRestoreTrades={handleRestoreTrades}
            isTrash={true}
            tagGroups={tagGroups}
          />
      )}
      
      {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              <div className="space-y-6">
                  {/* User Profile */}
                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg">User Profile</h3>
                          <button onClick={() => setIsUserModalOpen(true)} className="text-primary hover:underline text-sm">Edit</button>
                      </div>
                      {user ? (
                          <div className="space-y-2">
                              <p className="text-sm"><span className="text-textMuted">Name:</span> {user.name}</p>
                              <p className="text-sm"><span className="text-textMuted">API Key:</span> {user.twelveDataApiKey ? '••••••••' : 'Not Set'}</p>
                          </div>
                      ) : (
                          <p className="text-sm text-textMuted italic">No profile set.</p>
                      )}
                  </div>

                  {/* Account Management */}
                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                       <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg">Accounts</h3>
                          <button onClick={() => setIsAddAccountModalOpen(true)} className="bg-primary text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1">
                              <Plus size={14} /> Add
                          </button>
                      </div>
                      <div className="space-y-2">
                          {accounts.map(acc => (
                              <div key={acc.id} className="flex justify-between items-center p-3 bg-surfaceHighlight/30 border border-border rounded-lg">
                                  <div>
                                      <div className="font-bold text-sm">{acc.name}</div>
                                      <div className="text-xs text-textMuted">{acc.type} • {acc.currency}</div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                      <span className="font-mono text-sm font-bold">${acc.balance.toLocaleString()}</span>
                                      <button onClick={() => setAccountToDelete(acc)} className="text-textMuted hover:text-loss">
                                          <X size={16} />
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              
              <div className="space-y-6">
                  <TagManager groups={tagGroups} onUpdate={saveTagGroups} />
                  <StrategyManager strategies={strategies} onUpdate={saveStrategies} />
              </div>
          </div>
      )}

      {/* Slide-over Add Trade */}
      <AddTradeSidePanel 
          isOpen={showAddTrade} 
          onClose={() => setShowAddTrade(false)} 
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          strategies={strategies}
          onSave={handleSaveTrade}
      />

      {/* Trade View Modal (Quick View) */}
      {viewingTrade && (
          <TradeViewModal 
             trade={viewingTrade}
             account={accounts.find(a => a.id === viewingTrade.accountId)}
             onClose={() => setViewingTrade(null)}
             onEdit={() => {
                 setEditingTrade(viewingTrade);
                 setViewingTrade(null);
             }}
             onDelete={() => handleSoftDeleteTrade(viewingTrade.id)}
             onSave={handleSaveTrade}
             tagGroups={tagGroups}
             onUpdateBalance={handleUpdateBalance}
          />
      )}

      {/* Daily View Modal (From Calendar) */}
      {dailyViewDate && (
          <DailyViewModal 
             date={dailyViewDate}
             trades={currentAccountTrades.filter(t => t.entryDate.startsWith(dailyViewDate))}
             onClose={() => setDailyViewDate(null)}
             onTradeClick={(t) => {
                 setDailyViewDate(null);
                 setViewingTrade(t);
             }}
          />
      )}

      {/* Helper Modals */}
      {isUserModalOpen && <UserModal user={user} onSave={handleUserUpdate} onClose={() => setIsUserModalOpen(false)} />}
      {isAddAccountModalOpen && <AddAccountModal onSave={handleAddAccount} onClose={() => setIsAddAccountModalOpen(false)} />}
      {accountToDelete && <DeleteAccountModal accountToDelete={accountToDelete} otherAccounts={accounts.filter(a => a.id !== accountToDelete.id)} onConfirm={handleDeleteAccount} onClose={() => setAccountToDelete(null)} />}
      
    </Layout>
  );
}

export default App;
