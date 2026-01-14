
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TradeList from './components/TradeList';
import CalendarView from './components/CalendarView';
import TradeDetail from './components/TradeDetail';
import TradeViewModal from './components/TradeViewModal';
import DailyViewModal from './components/DailyViewModal';
import AddAccountModal from './components/AddAccountModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import DeleteAccountModal from './components/DeleteAccountModal';
import TagManager from './components/TagManager';
import StrategyManager from './components/StrategyManager';
import { getTrades, saveTrade, deleteTrades, getAccounts, saveAccount, deleteAccount, getTagGroups, saveTagGroups, getStrategies, saveStrategies, saveTrades, getSetting, saveSetting } from './services/storageService';
import { Trade, TradeStats, Account, TradeType, TradeStatus, ASSETS, TagGroup, OrderType, Session, TradeOutcome, User } from './types';
import { X, Loader2 } from 'lucide-react';
import UserModal from './components/UserModal';
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
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
        setFormData(prev => ({
            ...prev,
            accountId: selectedAccountId || (accounts.length > 0 ? accounts[0].id : '')
        }));
    }
  }, [isOpen, selectedAccountId, accounts]);

  const handleChange = (field: string, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClearForm = () => {
      setFormData({
        accountId: selectedAccountId || (accounts.length > 0 ? accounts[0].id : ''),
        symbol: 'XAUUSD',
        type: TradeType.LONG,
        entryPrice: '',
        entryDate: new Date().toISOString().slice(0, 16),
        quantity: '',
        stopLoss: '',
        takeProfit: '',
        setup: '',
        notes: ''
      });
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.entryPrice || !formData.quantity) return;

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
          entryPrice: parseFloat(formData.entryPrice),
          entryDate: entryDateObj.toISOString(),
          entryTime,
          entrySession,
          quantity: parseFloat(formData.quantity),
          stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
          takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
          setup: formData.setup,
          notes: formData.notes,
          tags: tags,
          pnl: 0,
          fees: 0,
          screenshots: [],
          createdAt: new Date().toISOString(),
          isDeleted: false,
          isBalanceUpdated: false
      };

      onSave(newTrade);
      handleClearForm();
      onClose();
  };

  if (!isOpen) return null;

  return (
      <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
          <div className="relative w-full max-w-md bg-surface shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300 border-l border-border">
              <div className="p-4 border-b border-border flex justify-between items-center bg-surfaceHighlight/30">
                  <h3 className="font-bold text-lg">Add New Trade</h3>
                  <button onClick={onClose} className="p-2 hover:bg-surfaceHighlight rounded-full text-textMuted hover:text-textMain">
                      <X size={20} />
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5">
                  <form id="add-trade-form" onSubmit={handleSubmit} className="space-y-5">
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
                                    className={`flex-1 text-xs font-bold py-1.5 rounded transition-colors ${formData.type === TradeType.LONG ? 'bg-profit text-white shadow' : 'text-textMuted hover:text-textMain'}`}
                                  >
                                      LONG
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleChange('type', TradeType.SHORT)}
                                    className={`flex-1 text-xs font-bold py-1.5 rounded transition-colors ${formData.type === TradeType.SHORT ? 'bg-loss text-white shadow' : 'text-textMuted hover:text-textMain'}`}
                                  >
                                      SHORT
                                  </button>
                              </div>
                          </div>
                      </div>

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

                      {accounts.length > 1 && (
                          <div>
                              <label className="block text-xs font-medium text-textMuted mb-1">Account</label>
                              <select 
                                value={formData.accountId}
                                onChange={(e) => handleChange('accountId', e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm focus:border-primary outline-none"
                              >
                                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (${a.balance})</option>)}
                              </select>
                          </div>
                      )}
                  </form>
              </div>

              <div className="p-4 border-t border-border flex gap-3 shrink-0 bg-surface">
                  <button 
                      type="submit" 
                      form="add-trade-form"
                      disabled={accounts.length === 0}
                      className={`w-full py-2 rounded-lg font-bold text-sm shadow-md transition-all ${
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
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [subView, setSubView] = useState<'list' | 'detail'>('list'); 
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null);
  
  // UI State
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tradesToDelete, setTradesToDelete] = useState<string[]>([]);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
      const savedTheme = localStorage.getItem('pipsuite_theme');
      return savedTheme ? savedTheme === 'dark' : true; 
  });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [userProfile, datePref, activeTabPref] = await Promise.all([
            getSetting<User | null>('pipsuite_user', null),
            getSetting<{start: string, end: string} | null>('pipsuite_date_range', null),
            getSetting<string>('pipsuite_active_tab', 'dashboard')
        ]);
        
        setUser(userProfile);
        if (datePref) {
            setStartDate(datePref.start);
            setEndDate(datePref.end);
        }
        if (activeTabPref) {
            setActiveTab(activeTabPref);
        }

        const [loadedAccounts, loadedTrades, loadedTags, loadedStrategies] = await Promise.all([
          getAccounts(), getTrades(), getTagGroups(), getStrategies()
        ]);
        
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
        const tradesToCleanup = loadedTrades.filter(t => t.isDeleted && t.deletedAt && new Date(t.deletedAt).getTime() < thirtyDaysAgo).map(t => t.id);
        
        let initialTrades = loadedTrades;
        if (tradesToCleanup.length > 0) {
            initialTrades = await deleteTrades(tradesToCleanup);
        }

        setAccounts(loadedAccounts);
        setTrades(initialTrades);
        setTagGroups(loadedTags);
        setStrategies(loadedStrategies);
        
        const savedAccountId = localStorage.getItem('pipsuite_selected_account_id');
        if (savedAccountId && loadedAccounts.some(acc => acc.id === savedAccountId)) {
            setSelectedAccountId(savedAccountId);
        } else if (loadedAccounts.length > 0) {
            setSelectedAccountId(loadedAccounts[0].id);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleAccountChange = (id: string) => {
      setSelectedAccountId(id);
      localStorage.setItem('pipsuite_selected_account_id', id);
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
      setStartDate(newStart);
      setEndDate(newEnd);
      saveSetting('pipsuite_date_range', { start: newStart, end: newEnd });
  };

  const handleTabChange = (tab: string) => {
      setActiveTab(tab);
      setSubView('list');
      saveSetting('pipsuite_active_tab', tab);
  };

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (t.isDeleted) return false;
      const tDate = new Date(t.entryDate || t.createdAt);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const dateMatch = tDate >= start && tDate <= end;
      const accountMatch = t.accountId === selectedAccountId;
      return dateMatch && accountMatch;
    });
  }, [trades, startDate, endDate, selectedAccountId]);

  const trashTrades = useMemo(() => {
      return trades.filter(t => t.isDeleted && t.accountId === selectedAccountId);
  }, [trades, selectedAccountId]);

  const selectedDailyTrades = useMemo(() => {
      if (!selectedDailyDate) return [];
      return trades.filter(t => {
          if (t.isDeleted) return false;
          const tDate = new Date(t.entryDate || t.createdAt).toLocaleDateString('en-CA');
          return tDate === selectedDailyDate && t.accountId === selectedAccountId;
      });
  }, [trades, selectedDailyDate, selectedAccountId]);

  const stats: TradeStats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    if (totalTrades === 0) return { totalTrades: 0, winRate: 0, netPnL: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, bestTrade: 0, worstTrade: 0 };
    const wins = filteredTrades.filter(t => t.pnl > 0);
    const losses = filteredTrades.filter(t => t.pnl <= 0);
    const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    return {
      totalTrades,
      winRate: (wins.length / totalTrades) * 100,
      netPnL: totalWinPnl - totalLossPnl,
      avgWin: wins.length ? totalWinPnl / wins.length : 0,
      avgLoss: losses.length ? totalLossPnl / losses.length : 0,
      profitFactor: totalLossPnl === 0 ? totalWinPnl : totalWinPnl / totalLossPnl,
      bestTrade: Math.max(...filteredTrades.map(t => t.pnl), 0),
      worstTrade: Math.min(...filteredTrades.map(t => t.pnl), 0)
    };
  }, [filteredTrades]);

  const handleSaveTrade = async (trade: Trade, shouldClose: boolean = true) => {
    try {
        const updatedTrades = await saveTrade(trade);
        setTrades(updatedTrades);
        if (shouldClose) setShowAddTrade(false);
    } catch (e) {
        alert("Failed to save trade. Check connection or data.");
    }
  };

  const handleImportTrades = async (newTrades: Trade[]) => {
      try {
          const updatedTrades = await saveTrades(newTrades);
          setTrades(updatedTrades);
          alert(`Successfully imported ${newTrades.length} trades.`);
      } catch (e) {
          alert("Failed to import trades. Check DB connection.");
      }
  };

  const handleRequestDelete = (ids: string[]) => {
      if (ids.length === 0) return;
      setTradesToDelete(ids);
      setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
      if (tradesToDelete.length === 0) return;
      try {
          if (activeTab === 'trash') {
              const updatedTrades = await deleteTrades(tradesToDelete);
              setTrades(updatedTrades);
          } else {
              const tradesToTrash = trades.filter(t => tradesToDelete.includes(t.id));
              const updatedTrades = trades.map(t => {
                  if (tradesToDelete.includes(t.id)) return { ...t, isDeleted: true, deletedAt: new Date().toISOString() };
                  return t;
              });
              for (const t of updatedTrades.filter(ut => tradesToDelete.includes(ut.id))) await saveTrade(t);
              setTrades(updatedTrades);
          }
          if (selectedTradeId && tradesToDelete.includes(selectedTradeId)) {
              setIsViewModalOpen(false);
              setSubView('list');
              setSelectedTradeId(null);
          }
      } catch (e) {
          alert("Failed to delete trades.");
      } finally {
          setIsDeleteModalOpen(false);
          setTradesToDelete([]);
      }
  };

  const handleRestoreTrades = async (ids: string[]) => {
      try {
          const updatedTrades = trades.map(t => {
              if (ids.includes(t.id)) return { ...t, isDeleted: false, deletedAt: undefined };
              return t;
          });
          for (const t of updatedTrades.filter(ut => ids.includes(ut.id))) await saveTrade(t);
          setTrades(updatedTrades);
      } catch (e) {
          alert("Failed to restore trades.");
      }
  };

  const handleAddAccount = async (accountData: Account) => {
      try {
        const updatedAccounts = await saveAccount({ ...accountData });
        setAccounts(updatedAccounts);
        handleAccountChange(accountData.id);
      } catch (e) {
        alert("Failed to create account.");
      }
  };

  const handleRequestDeleteAccount = (account: Account) => setAccountToDelete(account);

  const handleExecuteDeleteAccount = async (fallbackAccountId: string) => {
      if (!accountToDelete) return;
      try {
          await deleteAccount(accountToDelete.id);
          const newAccounts = accounts.filter(a => a.id !== accountToDelete.id);
          setAccounts(newAccounts);
          setTrades(prev => prev.filter(t => t.accountId !== accountToDelete.id));
          if (fallbackAccountId && newAccounts.find(a => a.id === fallbackAccountId)) handleAccountChange(fallbackAccountId);
          else if (newAccounts.length > 0) handleAccountChange(newAccounts[0].id);
          else handleAccountChange('');
          setAccountToDelete(null);
      } catch (e) {
          alert("Failed to delete account");
      }
  };

  const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw') => {
      const account = accounts.find(a => a.id === selectedAccountId);
      if (account) {
          const newBalance = type === 'deposit' ? account.balance + amount : account.balance - amount;
          try {
            const updatedAccounts = await saveAccount({ ...account, balance: newBalance });
            setAccounts(updatedAccounts);
          } catch(e) {
            alert("Failed to update balance.");
          }
      }
  };

  const handleUserUpdate = (userData: Partial<User>) => {
      const updatedUser = { ...user, ...userData, id: user?.id || 'u1' } as User;
      setUser(updatedUser);
      saveSetting('pipsuite_user', updatedUser);
  };

  const navigateToTrade = (trade: Trade) => {
    setSelectedTradeId(trade.id);
    setIsViewModalOpen(true); 
  };

  const renderContent = () => {
    if (subView === 'detail' && selectedTradeId) {
       const trade = trades.find(t => t.id === selectedTradeId);
       if (trade) return <TradeDetail trade={trade} onSave={handleSaveTrade} onDelete={(id) => handleRequestDelete([id])} onBack={() => setSubView('list')} accounts={accounts} tagGroups={tagGroups} strategies={strategies} onUpdateBalance={handleUpdateBalance} />;
    }
    switch (activeTab) {
      case 'dashboard': return <Dashboard stats={stats} trades={filteredTrades} tagGroups={tagGroups} />;
      case 'calendar': return <CalendarView trades={filteredTrades} currentMonth={currentCalendarMonth} setCurrentMonth={setCurrentCalendarMonth} onDayClick={(dateStr) => setSelectedDailyDate(dateStr)} />;
      case 'journal': return <TradeList trades={filteredTrades} selectedAccountId={selectedAccountId} onTradeClick={navigateToTrade} onDeleteTrade={(id) => handleRequestDelete([id])} onDeleteTrades={handleRequestDelete} onImportTrades={handleImportTrades} tagGroups={tagGroups} />;
      case 'trash': return <TradeList trades={trashTrades} selectedAccountId={selectedAccountId} onTradeClick={() => {}} onDeleteTrade={(id) => handleRequestDelete([id])} onDeleteTrades={handleRequestDelete} isTrash={true} onRestoreTrades={handleRestoreTrades} tagGroups={tagGroups} />;
      case 'settings': return (
          <div className="p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Settings</h2></div>
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6">
               <div className="flex justify-between items-center mb-2"><h3 className="font-semibold">User Profile</h3><button onClick={() => setIsUserModalOpen(true)} className="text-primary text-sm hover:underline">Edit</button></div>
               {user ? <div className="space-y-1"><p className="text-sm"><span className="text-textMuted">Name:</span> {user.name}</p></div> : <p className="text-sm text-textMuted italic">No profile set.</p>}
            </div>
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
               <div className="flex justify-between items-center mb-4"><h3 className="font-semibold">Trading Accounts</h3><button onClick={() => setIsAddAccountModalOpen(true)} className="text-primary text-sm font-medium hover:underline">+ Add New Account</button></div>
               <ul className="space-y-2">{accounts.map(acc => (<li key={acc.id} className="flex justify-between items-center p-3 bg-background rounded border border-border"><div className="flex flex-col"><span className="font-medium text-sm">{acc.name}</span><span className="text-xs text-textMuted">{acc.type} - {acc.currency}</span></div><div className="flex items-center gap-4"><span className="text-textMuted font-mono text-sm">${acc.balance.toLocaleString()}</span><button onClick={() => handleRequestDeleteAccount(acc)} className="text-textMuted hover:text-loss p-1"><X size={16} /></button></div></li>))}</ul>
            </div>
            <StrategyManager strategies={strategies} onUpdate={(s) => { saveStrategies(s); setStrategies(s); }} />
            <TagManager groups={tagGroups} onUpdate={(g) => { saveTagGroups(g); setTagGroups(g); }} />
          </div>
        );
      default: return <Dashboard stats={stats} trades={filteredTrades} tagGroups={tagGroups} />;
    }
  };

  const toggleTheme = () => {
      const newTheme = !isDarkMode ? 'dark' : 'light';
      setIsDarkMode(!isDarkMode);
      localStorage.setItem('pipsuite_theme', newTheme);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-background text-textMain"><div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-primary" size={48} /><p className="text-textMuted font-medium">Loading Journal...</p></div></div>;

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={handleTabChange}
      accounts={accounts} 
      selectedAccountId={selectedAccountId}
      setSelectedAccountId={handleAccountChange}
      onAddTradeClick={() => setShowAddTrade(true)} // Correctly opens side panel
      startDate={startDate}
      setStartDate={(d) => handleDateRangeChange(d, endDate)}
      endDate={endDate}
      setEndDate={(d) => handleDateRangeChange(startDate, d)}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
      onUpdateBalance={handleUpdateBalance}
    >
      {renderContent()}

      <AddTradeSidePanel 
          isOpen={showAddTrade} 
          onClose={() => setShowAddTrade(false)} 
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          strategies={strategies}
          onSave={handleSaveTrade}
      />

      {selectedDailyDate && <DailyViewModal date={selectedDailyDate} trades={selectedDailyTrades} onClose={() => setSelectedDailyDate(null)} onTradeClick={navigateToTrade} />}
      {isViewModalOpen && trades.find(t => t.id === selectedTradeId) && <TradeViewModal trade={trades.find(t => t.id === selectedTradeId)!} account={accounts.find(a => a.id === trades.find(t => t.id === selectedTradeId)?.accountId)} onClose={() => setIsViewModalOpen(false)} onEdit={() => { setIsViewModalOpen(false); setSubView('detail'); }} onDelete={() => handleRequestDelete([selectedTradeId!])} onSave={handleSaveTrade} tagGroups={tagGroups} onUpdateBalance={handleUpdateBalance} />}
      {isAddAccountModalOpen && <AddAccountModal onSave={handleAddAccount} onClose={() => setIsAddAccountModalOpen(false)} />}
      {isUserModalOpen && <UserModal user={user} onSave={handleUserUpdate} onClose={() => setIsUserModalOpen(false)} />}
      <DeleteConfirmationModal isOpen={isDeleteModalOpen} count={tradesToDelete.length} onConfirm={executeDelete} onCancel={() => setIsDeleteModalOpen(false)} />
      {accountToDelete && <DeleteAccountModal accountToDelete={accountToDelete} otherAccounts={accounts.filter(a => a.id !== accountToDelete.id)} onClose={() => setAccountToDelete(null)} onConfirm={handleExecuteDeleteAccount} />}
    </Layout>
  );
}

export default App;
