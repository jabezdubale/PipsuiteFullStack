
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
import AICoach from './components/AICoach';
import UserModal from './components/UserModal';
import { 
  getTrades, saveTrade, deleteTrade, deleteTrades, 
  getAccounts, saveAccount, deleteAccount, 
  getTagGroups, saveTagGroups, 
  getStrategies, saveStrategies, saveTrades, 
  getSetting, saveSetting
} from './services/storageService';
import { fetchCurrentPrice, PriceResult } from './services/priceService';
import { extractTradeParamsFromImage } from './services/geminiService';
import { Trade, TradeStats, Account, TradeType, TradeStatus, ASSETS, TagGroup, OrderType, Session, TradeOutcome, User } from './types';
import { X, ChevronDown, Calculator, TrendingUp, TrendingDown, RefreshCw, Loader2, Upload, Plus, Trash2, Clipboard, ChevronUp, Eraser } from 'lucide-react';
import { calculateAutoTags } from './utils/autoTagLogic';
import { getSessionForTime } from './utils/sessionHelpers';

// --- Add Trade Modal Component ---
const AddTradeModal = ({ 
  isOpen, 
  onClose, 
  accounts, 
  selectedAccountId, 
  strategies, 
  tagGroups,
  onSave 
}: {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  selectedAccountId: string;
  strategies: string[];
  tagGroups: TagGroup[];
  onSave: (trade: Trade) => Promise<boolean>; // Returns success status
}) => {
  const [formData, setFormData] = useState({
    accountId: selectedAccountId || '',
    symbol: 'XAUUSD',
    type: TradeType.LONG,
    entryPrice: '',
    currentPrice: '', // For limit/stop calc
    // Initialize with LOCAL time so date picker defaults to "Today" correctly
    entryDate: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16),
    quantity: '',
    stopLoss: '',
    takeProfit: '',
    setup: '',
    notes: '',
    emotionalNotes: '',
    balance: '',
    riskPercentage: '',
    leverage: '',
    tags: [] as string[],
    screenshots: [] as string[]
  });

  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisFileInputRef = useRef<HTMLInputElement>(null);

  // Sync account selection
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

  // Price Fetcher
  const fetchLatestPrice = async (symbol: string) => {
      if (!symbol) return;
      setIsFetchingPrice(true);
      try {
          const result = await fetchCurrentPrice(symbol);
          if (result) {
              setFormData(prev => ({ ...prev, currentPrice: result.price.toString() }));
          }
      } catch (error) {
          console.error("Price fetch error", error);
      } finally {
          setIsFetchingPrice(false);
      }
  };

  // Auto-fetch price on open
  useEffect(() => {
      if (isOpen && formData.symbol) {
          const t = setTimeout(() => fetchLatestPrice(formData.symbol), 500);
          return () => clearTimeout(t);
      }
  }, [isOpen, formData.symbol]);

  // Calculations
  const calculations = useMemo(() => {
      const { symbol, entryPrice, stopLoss, takeProfit, quantity, currentPrice, leverage, balance } = formData;
      const asset = ASSETS.find(a => a.assetPair === symbol);
      
      const entry = parseFloat(entryPrice);
      const qty = parseFloat(quantity);
      const sl = parseFloat(stopLoss);
      const tp = parseFloat(takeProfit);
      const curr = parseFloat(currentPrice);
      const lev = parseFloat(leverage) || 1;

      if (!asset || isNaN(entry)) return null;

      let riskAmount = 0;
      let rewardAmount = 0;
      let rr = 0;
      let orderType = OrderType.MARKET;

      // Order Type Logic
      if (!isNaN(curr)) {
          if (formData.type === TradeType.LONG) {
              if (entry < curr) orderType = OrderType.BUY_LIMIT;
              else if (entry > curr) orderType = OrderType.BUY_STOP;
          } else {
              if (entry > curr) orderType = OrderType.SELL_LIMIT;
              else if (entry < curr) orderType = OrderType.SELL_STOP;
          }
      }

      // Risk/Reward
      if (!isNaN(qty)) {
          if (!isNaN(sl)) {
              const riskDist = Math.abs(entry - sl);
              riskAmount = riskDist * asset.contractSize * qty;
          }
          if (!isNaN(tp)) {
              const rewardDist = Math.abs(tp - entry);
              rewardAmount = rewardDist * asset.contractSize * qty;
          }
      }

      if (riskAmount > 0 && rewardAmount > 0) {
          rr = rewardAmount / riskAmount;
      }

      const requiredMargin = !isNaN(qty) ? (entry * asset.contractSize * qty) / lev : 0;

      return { riskAmount, rewardAmount, rr, orderType, requiredMargin, asset };
  }, [formData]);

  // AI & Image Handlers
  const handleAnalyzeImage = async (base64: string) => {
      setIsAnalyzing(true);
      try {
          const data = await extractTradeParamsFromImage(base64);
          if (data) {
              setFormData(prev => ({
                  ...prev,
                  entryPrice: data.entryPrice?.toString() || prev.entryPrice,
                  takeProfit: data.takeProfit?.toString() || prev.takeProfit,
                  stopLoss: data.stopLoss?.toString() || prev.stopLoss
              }));
          }
      } catch (e) {
          alert("AI Analysis failed. Check API Key.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isAnalysis: boolean) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
          const res = reader.result as string;
          if (isAnalysis) handleAnalyzeImage(res);
          else setFormData(prev => ({ ...prev, screenshots: [...prev.screenshots, res] }));
      };
      reader.readAsDataURL(file);
  };

  const handlePaste = async () => {
      try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
              const type = item.types.find(t => t.startsWith('image/'));
              if (type) {
                  const blob = await item.getType(type);
                  const reader = new FileReader();
                  reader.onloadend = () => setFormData(prev => ({ ...prev, screenshots: [...prev.screenshots, reader.result as string] }));
                  reader.readAsDataURL(blob);
                  return;
              }
          }
          alert("No image in clipboard.");
      } catch (e) {
          alert("Clipboard access denied. Use Ctrl+V.");
      }
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!formData.entryPrice || !formData.quantity || !formData.accountId) {
          alert("Entry Price, Lot Size, and Account are required.");
          return;
      }

      setIsSubmitting(true);

      const entryDateObj = new Date(formData.entryDate);
      const entryTime = entryDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const newTrade: Trade = {
          id: `trade_${Date.now()}`,
          accountId: formData.accountId,
          symbol: formData.symbol,
          type: formData.type,
          status: TradeStatus.OPEN,
          outcome: TradeOutcome.OPEN,
          entryPrice: parseFloat(formData.entryPrice) || 0,
          entryDate: entryDateObj.toISOString(),
          entryTime,
          entrySession: getSessionForTime(entryDateObj),
          quantity: parseFloat(formData.quantity) || 0,
          stopLoss: formData.stopLoss ? parseFloat(formData.stopLoss) : undefined,
          takeProfit: formData.takeProfit ? parseFloat(formData.takeProfit) : undefined,
          setup: formData.setup,
          notes: formData.notes,
          emotionalNotes: formData.emotionalNotes,
          tags: formData.tags,
          screenshots: formData.screenshots,
          leverage: formData.leverage ? parseFloat(formData.leverage) : undefined,
          riskPercentage: formData.riskPercentage ? parseFloat(formData.riskPercentage) : undefined,
          balance: formData.balance ? parseFloat(formData.balance) : undefined,
          orderType: calculations?.orderType || OrderType.MARKET,
          fees: 0,
          pnl: 0,
          isDeleted: false
      };

      // Recalculate Auto Tags
      newTrade.tags = calculateAutoTags({
          tags: newTrade.tags,
          type: newTrade.type,
          entryPrice: newTrade.entryPrice,
          takeProfit: newTrade.takeProfit,
          stopLoss: newTrade.stopLoss
      });

      try {
          const success = await onSave(newTrade);
          if (success) {
              setFormData({
                accountId: formData.accountId, // Keep account
                symbol: 'XAUUSD',
                type: TradeType.LONG,
                entryPrice: '',
                currentPrice: '',
                // Reset to current LOCAL time
                entryDate: new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16),
                quantity: '',
                stopLoss: '',
                takeProfit: '',
                setup: '',
                notes: '',
                emotionalNotes: '',
                balance: formData.balance, // Keep balance
                riskPercentage: '',
                leverage: '',
                tags: [],
                screenshots: []
              });
              onClose();
          }
      } catch (err) {
          console.error(err);
      } finally {
          setIsSubmitting(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
        <div className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-border flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold">Add Trade</h3>
                <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={20}/></button>
            </div>

            {/* Toolbar */}
            <div className="px-5 py-3 border-b border-border flex justify-between items-center bg-surface shrink-0">
                <div className="flex gap-2">
                    <input type="file" ref={analysisFileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, true)} />
                    <button type="button" onClick={() => analysisFileInputRef.current?.click()} disabled={isAnalyzing} className="flex items-center gap-1.5 px-2 py-1 bg-surfaceHighlight hover:bg-border text-xs font-medium text-textMain rounded border border-border transition-colors disabled:opacity-50">
                        {isAnalyzing ? <Loader2 size={12} className="animate-spin"/> : <Upload size={12}/>} AI Fill
                    </button>
                    <button type="button" onClick={handlePaste} className="flex items-center gap-1.5 px-2 py-1 bg-surfaceHighlight hover:bg-border text-xs font-medium text-textMain rounded border border-border transition-colors">
                        <Clipboard size={12}/> Paste Img
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-textMuted uppercase font-bold">Balance:</span>
                    <input 
                        type="number" 
                        value={formData.balance} 
                        onChange={e => setFormData({...formData, balance: e.target.value})}
                        className="w-24 bg-transparent border-b border-dashed border-textMuted text-right font-mono font-bold text-sm focus:border-primary outline-none"
                        placeholder="0.00"
                    />
                </div>
            </div>

            {/* Form */}
            <div className="flex-1 overflow-y-auto p-5">
                <form id="add-trade-form" onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">Asset Pair</label>
                            <div className="relative">
                                <select value={formData.symbol} onChange={e => setFormData({...formData, symbol: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm appearance-none">
                                    {ASSETS.map(a => <option key={a.id} value={a.assetPair}>{a.assetPair}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none" size={14}/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">Direction</label>
                            <div className="flex bg-surfaceHighlight rounded p-1">
                                <button type="button" onClick={() => setFormData({...formData, type: TradeType.LONG})} className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1 ${formData.type === TradeType.LONG ? 'bg-profit text-white shadow' : 'text-textMuted'}`}><TrendingUp size={14}/> LONG</button>
                                <button type="button" onClick={() => setFormData({...formData, type: TradeType.SHORT})} className={`flex-1 text-xs font-bold py-1.5 rounded flex items-center justify-center gap-1 ${formData.type === TradeType.SHORT ? 'bg-loss text-white shadow' : 'text-textMuted'}`}><TrendingDown size={14}/> SHORT</button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">Entry Price</label>
                            <input type="number" step="any" value={formData.entryPrice} onChange={e => setFormData({...formData, entryPrice: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1 flex justify-between">Current Price <button type="button" onClick={() => fetchLatestPrice(formData.symbol)} disabled={isFetchingPrice}><RefreshCw size={10} className={isFetchingPrice ? 'animate-spin' : ''}/></button></label>
                            <input type="number" step="any" value={formData.currentPrice} onChange={e => setFormData({...formData, currentPrice: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm" placeholder="Optional" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">Stop Loss</label>
                            <input type="number" step="any" value={formData.stopLoss} onChange={e => setFormData({...formData, stopLoss: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm" placeholder="Optional" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">Take Profit</label>
                            <input type="number" step="any" value={formData.takeProfit} onChange={e => setFormData({...formData, takeProfit: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm" placeholder="Optional" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">Lot Size</label>
                            <input type="number" step="any" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm" required />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">Date</label>
                            <input type="datetime-local" value={formData.entryDate} onChange={e => setFormData({...formData, entryDate: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm" required />
                        </div>
                    </div>

                    {calculations && (
                        <div className="bg-surfaceHighlight/30 border border-border rounded p-3 text-xs space-y-2">
                            <div className="flex justify-between font-bold text-textMuted uppercase tracking-wider">
                                <span>Estimates</span>
                                {calculations.rr > 0 && <span className="text-primary">1:{calculations.rr.toFixed(2)} RR</span>}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="bg-background rounded p-1 border border-border/50">
                                    <span className="block text-[9px] text-textMuted uppercase">Risk</span>
                                    <span className="font-bold text-loss">${calculations.riskAmount.toFixed(2)}</span>
                                </div>
                                <div className="bg-background rounded p-1 border border-border/50">
                                    <span className="block text-[9px] text-textMuted uppercase">Reward</span>
                                    <span className="font-bold text-profit">${calculations.rewardAmount.toFixed(2)}</span>
                                </div>
                                <div className="bg-background rounded p-1 border border-border/50">
                                    <span className="block text-[9px] text-textMuted uppercase">Margin</span>
                                    <span className="font-mono">${calculations.requiredMargin.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Account</label>
                        <select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm" required>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (${a.balance})</option>)}
                        </select>
                        {accounts.length === 0 && <p className="text-[10px] text-loss mt-1">Please create an account first.</p>}
                    </div>

                    {/* Collapsible Details */}
                    <div>
                        <button type="button" onClick={() => setIsNotesOpen(!isNotesOpen)} className="flex items-center gap-2 text-xs font-bold text-textMuted uppercase tracking-wider hover:text-primary transition-colors">
                            {isNotesOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} More Details (Notes, Tags, Img)
                        </button>
                        {isNotesOpen && (
                            <div className="mt-3 space-y-3 animate-in slide-in-from-top-2">
                                <select value={formData.setup} onChange={e => setFormData({...formData, setup: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm">
                                    <option value="">Select Strategy</option>
                                    {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <textarea placeholder="Technical Notes..." value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm h-20 resize-none"/>
                                
                                {/* Screenshots Preview */}
                                {formData.screenshots.length > 0 && (
                                    <div className="grid grid-cols-4 gap-2">
                                        {formData.screenshots.map((url, i) => (
                                            <div key={i} className="aspect-square relative group bg-black/50 rounded overflow-hidden">
                                                <img src={url} className="w-full h-full object-cover" />
                                                <button type="button" onClick={() => setFormData(prev => ({...prev, screenshots: prev.screenshots.filter((_, idx) => idx !== i)}))} className="absolute top-0 right-0 bg-red-600 text-white p-0.5 opacity-0 group-hover:opacity-100"><X size={12}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, false)} />
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline flex items-center gap-1"><Upload size={12}/> Upload Image</button>
                                </div>
                            </div>
                        )}
                    </div>
                </form>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-surface flex gap-3 shrink-0 rounded-b-xl">
                <button type="button" onClick={() => { setFormData({...formData, entryPrice: '', quantity: '', stopLoss: '', takeProfit: '', notes: ''}); }} className="px-4 py-2 border border-border rounded-lg text-textMuted hover:text-textMain text-sm"><Eraser size={16}/></button>
                <button 
                    type="submit" 
                    form="add-trade-form" 
                    disabled={isSubmitting || accounts.length === 0} 
                    className="flex-1 bg-primary hover:bg-blue-600 text-white font-bold py-2 rounded-lg text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16}/>} Save Trade
                </button>
            </div>
        </div>
    </div>
  );
};

// --- Main App ---
function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  
  // UI State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false); // Controls the modal
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  const [dailyViewDate, setDailyViewDate] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Initialize Dashboard Date Range as empty (show all by default)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Initial Load
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      const themePref = await getSetting<string>('pipsuite_theme', 'light');
      setIsDarkMode(themePref === 'dark');
      const userProfile = await getSetting<User | null>('pipsuite_user', null);
      setUser(userProfile);
      
      const datePref = await getSetting<{start: string, end: string} | null>('pipsuite_date_range', null);
      if (datePref) {
          setStartDate(datePref.start);
          setEndDate(datePref.end);
      }

      const [accs, trds, tgs, strats] = await Promise.all([
          getAccounts(), getTrades(), getTagGroups(), getStrategies()
      ]);

      setAccounts(accs);
      setTrades(trds);
      setTagGroups(tgs);
      setStrategies(strats);

      // Restore selected account from local storage or default
      const savedAccId = localStorage.getItem('pipsuite_selected_account_id');
      if (savedAccId && accs.some(a => a.id === savedAccId)) {
          setSelectedAccountId(savedAccId);
      } else if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
      }
      setIsLoading(false);
    };
    initData();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
      const newTheme = !isDarkMode ? 'dark' : 'light';
      setIsDarkMode(!isDarkMode);
      saveSetting('pipsuite_theme', newTheme);
  };

  const handleAccountChange = (id: string) => {
      setSelectedAccountId(id);
      localStorage.setItem('pipsuite_selected_account_id', id);
  };

  // --- Data Helpers ---
  
  // PRIMARY DATA SOURCE FOR ALL TABS: Filters only by Account and Deleted Status.
  // Date filtering is removed here to ensure Journal/Calendar see all data.
  // The Dashboard component will handle its own local date filtering.
  const currentAccountTrades = useMemo(() => {
      if (!selectedAccountId) return [];
      return trades.filter(t => t.accountId === selectedAccountId && !t.isDeleted);
  }, [trades, selectedAccountId]);
  
  const trashTrades = useMemo(() => {
    if (!selectedAccountId) return [];
    return trades.filter(t => t.accountId === selectedAccountId && t.isDeleted);
  }, [trades, selectedAccountId]);

  // Global stats passed to dashboard (These stats are now redundant if dashboard calculates locally, keeping for safety)
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
          totalTrades, winRate, netPnL,
          avgWin: wins.length > 0 ? totalWon / wins.length : 0,
          avgLoss: losses.length > 0 ? totalLost / losses.length : 0,
          profitFactor,
          bestTrade: Math.max(...currentAccountTrades.map(t => t.pnl), 0),
          worstTrade: Math.min(...currentAccountTrades.map(t => t.pnl), 0)
      };
  }, [currentAccountTrades]);

  // --- Handlers ---
  const handleSaveTrade = async (trade: Trade, shouldClose: boolean = true): Promise<boolean> => {
    try {
        await saveTrade(trade);
        // Refresh trades to get updated list
        const updated = await getTrades(); 
        setTrades(updated);

        if (shouldClose) {
            setEditingTrade(null);
            setViewingTrade(null);
            setShowAddTrade(false);
        }
        return true;
    } catch (e: any) {
        console.error("Failed to save trade:", e);
        alert(`Failed to save trade: ${e.message || 'Unknown error'}`);
        return false;
    }
  };

  const handleDateRangeChange = (newStart: string, newEnd: string) => {
      setStartDate(newStart);
      setEndDate(newEnd);
      saveSetting('pipsuite_date_range', { start: newStart, end: newEnd });
  };

  const handleSoftDeleteTrade = async (id: string) => {
    const trade = trades.find(t => t.id === id);
    if (trade) {
       await saveTrade({ ...trade, isDeleted: true, deletedAt: new Date().toISOString() });
       setTrades(await getTrades());
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
      for (const t of updated) { if (ids.includes(t.id)) await saveTrade(t); }
      setTrades(await getTrades());
  };

  const handleAddAccount = async (account: Account) => {
      await saveAccount(account);
      const updated = await getAccounts();
      setAccounts(updated);
      handleAccountChange(account.id);
  };

  const handleDeleteAccount = async () => {
      if (!accountToDelete) return;
      await deleteAccount(accountToDelete.id);
      const updated = await getAccounts();
      setAccounts(updated);
      handleAccountChange(updated.length > 0 ? updated[0].id : '');
      setAccountToDelete(null);
  };

  const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw') => {
      const account = accounts.find(a => a.id === selectedAccountId);
      if (!account) return;
      const newBalance = type === 'deposit' ? account.balance + amount : account.balance - amount;
      await saveAccount({ ...account, balance: newBalance });
      setAccounts(await getAccounts());
  };

  const handleUserUpdate = (userData: Partial<User>) => {
      const updatedUser = { ...user, ...userData, id: user?.id || 'u1' } as User;
      setUser(updatedUser);
      saveSetting('pipsuite_user', updatedUser);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" size={32}/></div>;

  if (editingTrade) {
      return <TradeDetail trade={editingTrade} accounts={accounts} tagGroups={tagGroups} strategies={strategies} onSave={handleSaveTrade} onDelete={handleSoftDeleteTrade} onBack={() => setEditingTrade(null)} onUpdateBalance={handleUpdateBalance} />;
  }

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      accounts={accounts}
      selectedAccountId={selectedAccountId}
      setSelectedAccountId={handleAccountChange}
      onAddTradeClick={() => setShowAddTrade(true)} // Open unified modal
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
      onUpdateBalance={handleUpdateBalance}
    >
      {activeTab === 'dashboard' && (
          <div className="space-y-6">
              <Dashboard 
                stats={stats} 
                trades={currentAccountTrades} 
                tagGroups={tagGroups}
                startDate={startDate}
                endDate={endDate}
                onDateChange={handleDateRangeChange}
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
            onImportTrades={async (newTrades) => { await saveTrades(newTrades); setTrades(await getTrades()); }}
            tagGroups={tagGroups}
          />
      )}

      {activeTab === 'calendar' && (
          <CalendarView 
             trades={currentAccountTrades}
             currentMonth={currentMonth}
             setCurrentMonth={setCurrentMonth}
             onDayClick={(date) => setDailyViewDate(date)}
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
                      ) : <p className="text-sm text-textMuted italic">No profile set.</p>}
                  </div>

                  <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                       <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-lg">Accounts</h3>
                          <button onClick={() => setIsAddAccountModalOpen(true)} className="bg-primary text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><Plus size={14} /> Add</button>
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
                                      <button onClick={() => setAccountToDelete(acc)} className="text-textMuted hover:text-loss"><X size={16} /></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              <div className="space-y-6">
                  <TagManager groups={tagGroups} onUpdate={(g) => { saveTagGroups(g); setTagGroups(g); }} />
                  <StrategyManager strategies={strategies} onUpdate={(s) => { saveStrategies(s); setStrategies(s); }} />
              </div>
          </div>
      )}

      {/* MODALS */}
      <AddTradeModal 
          isOpen={showAddTrade} 
          onClose={() => setShowAddTrade(false)} 
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          strategies={strategies}
          tagGroups={tagGroups}
          onSave={handleSaveTrade}
      />

      {viewingTrade && (
          <TradeViewModal 
             trade={viewingTrade}
             account={accounts.find(a => a.id === viewingTrade.accountId)}
             onClose={() => setViewingTrade(null)}
             onEdit={() => { setEditingTrade(viewingTrade); setViewingTrade(null); }}
             onDelete={() => handleSoftDeleteTrade(viewingTrade.id)}
             onSave={handleSaveTrade}
             tagGroups={tagGroups}
             onUpdateBalance={handleUpdateBalance}
          />
      )}

      {dailyViewDate && (
          <DailyViewModal 
             date={dailyViewDate}
             trades={currentAccountTrades.filter(t => t.entryDate.startsWith(dailyViewDate))}
             onClose={() => setDailyViewDate(null)}
             onTradeClick={(t) => { setDailyViewDate(null); setViewingTrade(t); }}
          />
      )}

      {isUserModalOpen && <UserModal user={user} onSave={handleUserUpdate} onClose={() => setIsUserModalOpen(false)} />}
      {isAddAccountModalOpen && <AddAccountModal onSave={handleAddAccount} onClose={() => setIsAddAccountModalOpen(false)} />}
      {accountToDelete && <DeleteAccountModal accountToDelete={accountToDelete} otherAccounts={accounts.filter(a => a.id !== accountToDelete.id)} onConfirm={handleDeleteAccount} onClose={() => setAccountToDelete(null)} />}
      
    </Layout>
  );
}

export default App;
