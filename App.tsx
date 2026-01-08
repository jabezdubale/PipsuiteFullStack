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
import { fetchCurrentPrice, PriceResult } from './services/priceService';
import { extractTradeParamsFromImage } from './services/geminiService';
import { Trade, TradeStats, Account, TradeType, TradeStatus, ASSETS, TagGroup, OrderType, Session, TradeOutcome, User } from './types';
import { X, ChevronDown, Calculator, TrendingUp, TrendingDown, RefreshCw, Loader2, Upload, Plus, Trash2, Clipboard, ChevronUp, Eraser } from 'lucide-react';
import UserModal from './components/UserModal';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [subView, setSubView] = useState<'list' | 'detail'>('list'); 
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  
  // Data State
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Selection State
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Filter State - Default to Current Month for clean UI
  const [startDate, setStartDate] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Calendar State
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  // Daily View State
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tradesToDelete, setTradesToDelete] = useState<string[]>([]);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Price Fetching State
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceSource, setPriceSource] = useState<PriceResult | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [newTradeForm, setNewTradeForm] = useState<any>({ symbol: 'XAUUSD', screenshots: [], tags: [], setup: '' });
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisFileInputRef = useRef<HTMLInputElement>(null);

  // Initial Data Load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Settings & User
        const [themePref, userProfile, datePref] = await Promise.all([
            getSetting<string>('pipsuite_theme', 'dark'),
            getSetting<User | null>('pipsuite_user', null),
            getSetting<{start: string, end: string} | null>('pipsuite_date_range', null)
        ]);

        setIsDarkMode(themePref === 'dark');
        setUser(userProfile);

        // Restore date range if it was saved (Fixes disappearing trades bug)
        if (datePref) {
            setStartDate(datePref.start);
            setEndDate(datePref.end);
        }

        // 2. Data
        const [loadedAccounts, loadedTrades, loadedTags, loadedStrategies] = await Promise.all([
          getAccounts(),
          getTrades(),
          getTagGroups(),
          getStrategies()
        ]);
        
        // Auto Cleanup: Permanently delete trash items older than 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
        const tradesToCleanup = loadedTrades.filter(t => t.isDeleted && t.deletedAt && new Date(t.deletedAt).getTime() < thirtyDaysAgo).map(t => t.id);
        
        let initialTrades = loadedTrades;
        if (tradesToCleanup.length > 0) {
            initialTrades = await deleteTrades(tradesToCleanup); // Permanent delete
        }

        setAccounts(loadedAccounts);
        setTrades(initialTrades);
        setTagGroups(loadedTags);
        setStrategies(loadedStrategies);
        
        // Auto-select first account if none selected
        if (loadedAccounts.length > 0 && !selectedAccountId) {
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

  // Update form balance
  useEffect(() => {
    if (isAddModalOpen && selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId);
      if (acc) {
        setNewTradeForm((prev: any) => ({ ...prev, balance: acc.balance, symbol: prev.symbol || 'XAUUSD' }));
      }
    }
  }, [isAddModalOpen, selectedAccountId, accounts]);

  // Paste Listener for Add Modal
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isAddModalOpen) return; // Only listen when modal is open

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              if (base64) {
                 // Add to screenshots
                 setNewTradeForm((prev: any) => ({
                    ...prev,
                    screenshots: [...(prev.screenshots || []), base64]
                 }));
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [isAddModalOpen]);

  // AI Analysis Handler
  const handleAnalyzeImage = async (base64: string) => {
    setIsAnalyzing(true);
    try {
        const extractedData = await extractTradeParamsFromImage(base64);
        
        if (extractedData) {
            setNewTradeForm((prev: any) => ({
                ...prev,
                entryPrice: extractedData.entryPrice ? extractedData.entryPrice.toString() : prev.entryPrice,
                takeProfit: extractedData.takeProfit ? extractedData.takeProfit.toString() : prev.takeProfit,
                stopLoss: extractedData.stopLoss ? extractedData.stopLoss.toString() : prev.stopLoss,
            }));
        }
    } catch (error) {
        console.error("AI Analysis Failed", error);
        alert("Failed to analyze image. Please ensure your API Key is valid.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleAnalysisFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64 = reader.result as string;
              handleAnalyzeImage(base64);
          };
          reader.readAsDataURL(file);
      }
  };

  const handleClipboardAnalysis = async () => {
      try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
              const imageType = item.types.find(type => type.startsWith('image/'));
              if (imageType) {
                  const blob = await item.getType(imageType);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      const base64 = reader.result as string;
                      handleAnalyzeImage(base64);
                  };
                  reader.readAsDataURL(blob);
                  return;
              }
          }
          alert("No image found in clipboard.");
      } catch (err) {
          console.error("Clipboard access failed:", err);
          alert("Unable to access clipboard directly. Please use Ctrl+V or the Upload button.");
      }
  };

  // Fetch Price Helper
  const fetchLatestPrice = async (symbol: string) => {
      if (!symbol) return;
      setIsFetchingPrice(true);
      setPriceSource(null);
      setPriceError(null);
      
      try {
          const result = await fetchCurrentPrice(symbol);
          if (result) {
              setNewTradeForm((prev: any) => ({
                  ...prev,
                  currentPrice: result.price.toString()
              }));
              setPriceSource(result);
          }
      } catch (error) {
          console.error("Failed to fetch price", error);
          const msg = error instanceof Error ? error.message : "Error fetching price";
          setPriceError(msg);
          setTimeout(() => setPriceError(null), 4000);
      } finally {
          setIsFetchingPrice(false);
      }
  };

  useEffect(() => {
    if (isAddModalOpen && newTradeForm.symbol) {
        const timer = setTimeout(() => {
            fetchLatestPrice(newTradeForm.symbol);
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isAddModalOpen, newTradeForm.symbol]);

  // Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Date Range Handling with Persistence
  const handleDateRangeChange = (newStart: string, newEnd: string) => {
      setStartDate(newStart);
      setEndDate(newEnd);
      saveSetting('pipsuite_date_range', { start: newStart, end: newEnd });
  };

  // Trades Filtering
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      // Exclude deleted trades from main view
      if (t.isDeleted) return false;

      // Use Entry Time (entryDate) as primary date, fallback to Log Time
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
          // Use Entry Time (entryDate) as primary date
          const tDate = new Date(t.entryDate || t.createdAt).toLocaleDateString('en-CA');
          return tDate === selectedDailyDate && t.accountId === selectedAccountId;
      });
  }, [trades, selectedDailyDate, selectedAccountId]);


  // Stats
  const stats: TradeStats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    if (totalTrades === 0) {
      return { totalTrades: 0, winRate: 0, netPnL: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, bestTrade: 0, worstTrade: 0 };
    }

    const wins = filteredTrades.filter(t => t.pnl > 0);
    const losses = filteredTrades.filter(t => t.pnl <= 0);
    
    const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    
    const netPnL = totalWinPnl - totalLossPnl;
    const winRate = (wins.length / totalTrades) * 100;
    const avgWin = wins.length ? totalWinPnl / wins.length : 0;
    const avgLoss = losses.length ? totalLossPnl / losses.length : 0;
    const profitFactor = totalLossPnl === 0 ? totalWinPnl : totalWinPnl / totalLossPnl;
    
    const bestTrade = Math.max(...filteredTrades.map(t => t.pnl), 0);
    const worstTrade = Math.min(...filteredTrades.map(t => t.pnl), 0);

    return { totalTrades, winRate, netPnL, avgWin, avgLoss, profitFactor, bestTrade, worstTrade };
  }, [filteredTrades]);

  // --- Async Handlers ---

  const handleSaveTrade = async (trade: Trade, shouldClose: boolean = true) => {
    try {
        const updatedTrades = await saveTrade(trade);
        setTrades(updatedTrades);
        
        if (shouldClose) {
            setSubView('list');
            setIsAddModalOpen(false);
        }
    } catch (e) {
        alert("Failed to save trade.");
    }
  };

  const handleImportTrades = async (newTrades: Trade[]) => {
      try {
          const updatedTrades = await saveTrades(newTrades);
          setTrades(updatedTrades);
          
          // Auto-expand Date Range if needed
          if (newTrades.length > 0) {
              const timestamps = newTrades.map(t => new Date(t.entryDate || t.createdAt).getTime()).filter(t => !isNaN(t));
              if (timestamps.length > 0) {
                  const minTime = Math.min(...timestamps);
                  const maxTime = Math.max(...timestamps);
                  
                  const minDate = new Date(minTime).toISOString().split('T')[0];
                  const maxDate = new Date(maxTime).toISOString().split('T')[0];
                  
                  let newStart = startDate;
                  let newEnd = endDate;

                  // Only expand, don't shrink if current view is wider
                  if (minDate < startDate) newStart = minDate;
                  if (maxDate > endDate) newEnd = maxDate;

                  if (newStart !== startDate || newEnd !== endDate) {
                      handleDateRangeChange(newStart, newEnd);
                  }
              }
          }

          alert(`Successfully imported ${newTrades.length} trades.`);
      } catch (e) {
          alert("Failed to import trades.");
          console.error(e);
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
          const isPermanentDelete = activeTab === 'trash';

          if (isPermanentDelete) {
              const updatedTrades = await deleteTrades(tradesToDelete);
              setTrades(updatedTrades);
          } else {
              const tradesToTrash = trades.filter(t => tradesToDelete.includes(t.id));
              
              const balanceAdjustments: Record<string, number> = {};
              tradesToTrash.forEach(t => {
                  if (t.isBalanceUpdated && t.accountId && t.pnl !== 0) {
                      balanceAdjustments[t.accountId] = (balanceAdjustments[t.accountId] || 0) + t.pnl;
                  }
              });

              const updatedAccountsList = [...accounts];
              let accountsChanged = false;

              for (const [accId, totalPnl] of Object.entries(balanceAdjustments)) {
                  const accIndex = updatedAccountsList.findIndex(a => a.id === accId);
                  if (accIndex >= 0) {
                      const currentBalance = updatedAccountsList[accIndex].balance;
                      const newBalance = currentBalance - totalPnl;
                      
                      updatedAccountsList[accIndex] = {
                          ...updatedAccountsList[accIndex],
                          balance: newBalance
                      };
                      
                      await saveAccount(updatedAccountsList[accIndex]);
                      accountsChanged = true;
                  }
              }

              if (accountsChanged) {
                  setAccounts(updatedAccountsList);
              }

              const updatedTrades = trades.map(t => {
                  if (tradesToDelete.includes(t.id)) {
                      return { 
                          ...t, 
                          isDeleted: true, 
                          deletedAt: new Date().toISOString()
                      };
                  }
                  return t;
              });
              
              for (const t of updatedTrades.filter(ut => tradesToDelete.includes(ut.id))) {
                  await saveTrade(t);
              }
              
              setTrades(updatedTrades);
          }

          if (selectedTradeId && tradesToDelete.includes(selectedTradeId)) {
              setIsViewModalOpen(false);
              setSubView('list');
              setSelectedTradeId(null);
          }

      } catch (e) {
          console.error(e);
          alert("Failed to delete trades.");
      } finally {
          setIsDeleteModalOpen(false);
          setTradesToDelete([]);
      }
  };

  const handleRestoreTrades = async (ids: string[]) => {
      try {
          const tradesToRestore = trades.filter(t => ids.includes(t.id));
          const balanceAdjustments: Record<string, number> = {};

          tradesToRestore.forEach(t => {
              if (t.isBalanceUpdated && t.pnl !== 0 && t.accountId) {
                  balanceAdjustments[t.accountId] = (balanceAdjustments[t.accountId] || 0) + t.pnl;
              }
          });

          const updatedAccountsList = [...accounts];
          let accountsChanged = false;

          for (const [accId, totalPnl] of Object.entries(balanceAdjustments)) {
              const accIndex = updatedAccountsList.findIndex(a => a.id === accId);
              if (accIndex >= 0) {
                  const currentBalance = updatedAccountsList[accIndex].balance;
                  const newBalance = currentBalance + totalPnl;
                  
                  updatedAccountsList[accIndex] = {
                      ...updatedAccountsList[accIndex],
                      balance: newBalance
                  };
                  
                  await saveAccount(updatedAccountsList[accIndex]);
                  accountsChanged = true;
              }
          }

          if (accountsChanged) {
              setAccounts(updatedAccountsList);
          }

          const updatedTrades = trades.map(t => {
              if (ids.includes(t.id)) {
                  return { 
                      ...t, 
                      isDeleted: false, 
                      deletedAt: undefined,
                  };
              }
              return t;
          });

          for (const t of updatedTrades.filter(ut => ids.includes(ut.id))) {
              await saveTrade(t);
          }

          setTrades(updatedTrades);

      } catch (e) {
          console.error(e);
          alert("Failed to restore trades.");
      }
  };

  const handleAddAccount = async (accountData: Account) => {
      const account: Account = { ...accountData };
      try {
        const updatedAccounts = await saveAccount(account);
        setAccounts(updatedAccounts);
        setSelectedAccountId(account.id);
      } catch (e) {
        alert("Failed to create account.");
      }
  };

  const handleRequestDeleteAccount = (account: Account) => {
      setAccountToDelete(account);
  };

  const handleExecuteDeleteAccount = async (fallbackAccountId: string) => {
      if (!accountToDelete) return;
      try {
          await deleteAccount(accountToDelete.id);
          
          const newAccounts = accounts.filter(a => a.id !== accountToDelete.id);
          setAccounts(newAccounts);
          setTrades(prev => prev.filter(t => t.accountId !== accountToDelete.id));
          
          if (fallbackAccountId && newAccounts.find(a => a.id === fallbackAccountId)) {
              setSelectedAccountId(fallbackAccountId);
          } else if (newAccounts.length > 0) {
              setSelectedAccountId(newAccounts[0].id);
          } else {
              setSelectedAccountId('');
          }
          
          setAccountToDelete(null);
      } catch (e) {
          alert("Failed to delete account");
      }
  };

  const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw') => {
      const account = accounts.find(a => a.id === selectedAccountId);
      if (account) {
          const newBalance = type === 'deposit' 
            ? account.balance + amount 
            : account.balance - amount;
          
          const updatedAccount = { ...account, balance: newBalance };
          try {
            const updatedAccounts = await saveAccount(updatedAccount);
            setAccounts(updatedAccounts);
          } catch(e) {
            alert("Failed to update balance.");
          }
      }
  };

  const handleUpdateTags = async (newGroups: TagGroup[]) => {
      try {
          const updated = await saveTagGroups(newGroups);
          setTagGroups(updated);
      } catch (e) {
          alert("Failed to update tags");
      }
  };

  const handleUpdateStrategies = async (newStrategies: string[]) => {
      try {
          const updated = await saveStrategies(newStrategies);
          setStrategies(updated);
      } catch (e) {
          alert("Failed to update strategies");
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image file is too large. Please upload an image smaller than 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setNewTradeForm((prev: any) => ({
            ...prev,
            screenshots: [...(prev.screenshots || []), base64String]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddImageFromUrl = () => {
      if (newImageUrl) {
          setNewTradeForm((prev: any) => ({
              ...prev,
              screenshots: [...(prev.screenshots || []), newImageUrl]
          }));
          setNewImageUrl('');
      }
  }

  const handleRemoveImage = (index: number) => {
      setNewTradeForm((prev: any) => ({
          ...prev,
          screenshots: prev.screenshots.filter((_: any, i: number) => i !== index)
      }));
  }

  const toggleTag = (tag: string) => {
    setNewTradeForm((prev: any) => {
      const currentTags = prev.tags || [];
      if (currentTags.includes(tag)) {
        return { ...prev, tags: currentTags.filter((t: string) => t !== tag) };
      } else {
        return { ...prev, tags: [...currentTags, tag] };
      }
    });
  };

  const navigateToTrade = (trade: Trade) => {
    setSelectedTradeId(trade.id);
    setIsViewModalOpen(true); 
  };
  
  const handleEditFromModal = () => {
      setIsViewModalOpen(false);
      setSubView('detail');
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTradeForm.symbol || !newTradeForm.entryPrice) return;

    const entryPrice = parseFloat(newTradeForm.entryPrice);
    const takeProfit = newTradeForm.takeProfit ? parseFloat(newTradeForm.takeProfit) : undefined;
    
    let determinedType = TradeType.LONG;
    if (takeProfit && entryPrice) {
      if (takeProfit < entryPrice) {
        determinedType = TradeType.SHORT;
      }
    } else if (newTradeForm.stopLoss && entryPrice) {
       if (parseFloat(newTradeForm.stopLoss) > entryPrice) {
           determinedType = TradeType.SHORT;
       }
    }

    let determinedOrderType = OrderType.MARKET;
    if (tradeCalculations?.orderType) {
         if (tradeCalculations.orderType.includes('Limit')) {
             determinedOrderType = tradeCalculations.orderType.includes('Buy') ? OrderType.BUY_LIMIT : OrderType.SELL_LIMIT;
         } else if (tradeCalculations.orderType.includes('Stop')) {
             determinedOrderType = tradeCalculations.orderType.includes('Buy') ? OrderType.BUY_STOP : OrderType.SELL_STOP;
         }
    }

    const now = new Date();
    const isoString = now.toISOString();

    const newTrade: Trade = {
      id: Date.now().toString(),
      accountId: selectedAccountId,
      symbol: (newTradeForm.symbol || 'XAUUSD').toUpperCase(),
      type: determinedType,
      createdAt: isoString, 
      entryDate: isoString, 
      entryTime: undefined, 
      entrySession: Session.NONE, 
      entryPrice: entryPrice,
      takeProfit: takeProfit,
      stopLoss: newTradeForm.stopLoss ? parseFloat(newTradeForm.stopLoss) : undefined,
      leverage: newTradeForm.leverage ? parseFloat(newTradeForm.leverage) : undefined,
      quantity: parseFloat(newTradeForm.quantity || 0),
      riskPercentage: newTradeForm.riskPercentage ? parseFloat(newTradeForm.riskPercentage) : undefined,
      fees: 0,
      balance: newTradeForm.balance ? parseFloat(newTradeForm.balance) : undefined,
      orderType: determinedOrderType,
      setup: 'SMC', 
      notes: newTradeForm.notes || '',
      emotionalNotes: newTradeForm.emotionalNotes || '',
      pnl: 0,
      status: TradeStatus.OPEN,
      outcome: TradeOutcome.OPEN,
      screenshots: newTradeForm.screenshots || [],
      tags: newTradeForm.tags || [],
      isDeleted: false
    };

    handleSaveTrade(newTrade);
    setNewTradeForm({ symbol: 'XAUUSD', screenshots: [], tags: [], setup: '' });
  };

  const handleClearForm = () => {
    setNewTradeForm((prev: any) => ({
      symbol: prev.symbol,
      currentPrice: prev.currentPrice,
      balance: prev.balance,
      entryPrice: '',
      takeProfit: '',
      stopLoss: '',
      leverage: '',
      quantity: '',
      riskPercentage: '',
      setup: '',
      notes: '',
      emotionalNotes: '',
      screenshots: [],
      tags: []
    }));
    setNewImageUrl('');
  };

  const canCalculateRisk = useMemo(() => {
    return !!(
      newTradeForm.symbol &&
      newTradeForm.entryPrice &&
      newTradeForm.stopLoss &&
      newTradeForm.balance &&
      parseFloat(newTradeForm.entryPrice) !== parseFloat(newTradeForm.stopLoss)
    );
  }, [newTradeForm.symbol, newTradeForm.entryPrice, newTradeForm.stopLoss, newTradeForm.balance]);

  const isFormComplete = useMemo(() => {
    const { symbol, entryPrice, takeProfit, stopLoss, leverage, balance, quantity, riskPercentage } = newTradeForm;
    return !!(
        symbol && 
        entryPrice && 
        takeProfit && 
        stopLoss && 
        leverage && 
        balance && 
        quantity && 
        riskPercentage
    );
  }, [newTradeForm]);

  const tradeCalculations = useMemo(() => {
    const { symbol, entryPrice, currentPrice, takeProfit, stopLoss, quantity, leverage, balance, riskPercentage } = newTradeForm;
    
    if (!symbol || !entryPrice) return null;

    const asset = ASSETS.find(a => a.assetPair === symbol);
    if (!asset) return null;

    const entry = parseFloat(entryPrice);
    const current = parseFloat(currentPrice);
    const tp = parseFloat(takeProfit);
    const sl = parseFloat(stopLoss);
    const lots = parseFloat(quantity);
    const lev = parseFloat(leverage) || 1;

    let direction = 'LONG';
    if (!isNaN(tp)) {
        direction = tp > entry ? 'LONG' : 'SHORT';
    } else if (!isNaN(sl)) {
        direction = sl < entry ? 'LONG' : 'SHORT';
    }

    let orderType = '-';
    if (!isNaN(current) && !isNaN(entry)) {
        if (direction === 'LONG') {
             if (entry < current) orderType = 'Buy Limit';
             else if (entry > current) orderType = 'Buy Stop';
             else orderType = 'Market Buy';
        } else {
             if (entry > current) orderType = 'Sell Limit';
             else if (entry < current) orderType = 'Sell Stop';
             else orderType = 'Market Sell';
        }
    }

    const contractSize = asset.contractSize;
    
    const calculateDistances = (target: number) => {
        if (isNaN(target)) return { points: 0, pips: 0, ticks: 0 };
        const dist = Math.abs(target - entry);
        return {
            points: dist,
            pips: dist / asset.pip,
            ticks: dist / asset.tick
        };
    };

    const tpCalc = calculateDistances(tp);
    const slCalc = calculateDistances(sl);

    let riskAmount = 0;
    let potentialProfit = 0;
    
    if (!isNaN(lots)) {
        if (!isNaN(sl)) {
            riskAmount = slCalc.points * contractSize * lots;
        }
        if (!isNaN(tp)) {
            potentialProfit = tpCalc.points * contractSize * lots;
        }
    }

    let displayRisk = riskAmount;
    if (balance && riskPercentage) {
        const bal = parseFloat(balance);
        const rp = parseFloat(riskPercentage);
        if (!isNaN(bal) && !isNaN(rp)) {
             const theoreticalRisk = bal * (rp / 100);
             if (riskAmount > 0 && Math.abs(riskAmount - theoreticalRisk) < (theoreticalRisk * 0.05)) {
                 displayRisk = theoreticalRisk;
             }
        }
    }

    let rr = 0;
    if (displayRisk > 0) {
        rr = potentialProfit / displayRisk;
    }

    let requiredMargin = 0;
    if (!isNaN(lots) && !isNaN(entry)) {
        requiredMargin = (entry * contractSize * lots) / lev;
    }

    return {
        direction,
        orderType,
        tpCalc,
        slCalc,
        riskAmount: displayRisk,
        potentialProfit,
        rr,
        requiredMargin
    };
  }, [newTradeForm]);

  const handleLotSizeChange = (val: string) => {
    setNewTradeForm(prev => ({ ...prev, quantity: val }));
    if (!canCalculateRisk || !newTradeForm.symbol || !val) return;
    const lots = parseFloat(val);
    if (isNaN(lots)) return;
    const asset = ASSETS.find(a => a.assetPair === newTradeForm.symbol);
    if (!asset) return;
    const entry = parseFloat(newTradeForm.entryPrice);
    const sl = parseFloat(newTradeForm.stopLoss);
    const balance = parseFloat(newTradeForm.balance);
    const priceDiff = Math.abs(entry - sl);
    const riskAmount = priceDiff * asset.contractSize * lots;
    const riskPct = (riskAmount / balance) * 100;
    setNewTradeForm(prev => ({ ...prev, quantity: val, riskPercentage: riskPct.toFixed(3) }));
  };

  const handleRiskPctChange = (val: string) => {
    setNewTradeForm(prev => ({ ...prev, riskPercentage: val }));
    if (!canCalculateRisk || !newTradeForm.symbol || !val) return;
    const riskPct = parseFloat(val);
    if (isNaN(riskPct)) return;
    const asset = ASSETS.find(a => a.assetPair === newTradeForm.symbol);
    if (!asset) return;
    const entry = parseFloat(newTradeForm.entryPrice);
    const sl = parseFloat(newTradeForm.stopLoss);
    const balance = parseFloat(newTradeForm.balance);
    const riskAmount = balance * (riskPct / 100);
    const priceDiff = Math.abs(entry - sl);
    const lots = riskAmount / (priceDiff * asset.contractSize);
    setNewTradeForm(prev => ({ ...prev, riskPercentage: val, quantity: lots.toFixed(4) }));
  };

  const toggleTheme = () => {
      const newTheme = !isDarkMode ? 'dark' : 'light';
      setIsDarkMode(!isDarkMode);
      saveSetting('pipsuite_theme', newTheme);
  };

  const handleUserUpdate = (userData: Partial<User>) => {
      const updatedUser = { ...user, ...userData, id: user?.id || 'u1' } as User;
      setUser(updatedUser);
      saveSetting('pipsuite_user', updatedUser);
  };

  const renderContent = () => {
    if (subView === 'detail' && selectedTradeId) {
       const trade = trades.find(t => t.id === selectedTradeId);
       if (trade) {
         return <TradeDetail 
            trade={trade} 
            onSave={handleSaveTrade} 
            onDelete={(id) => handleRequestDelete([id])} 
            onBack={() => setSubView('list')} 
            accounts={accounts} 
            tagGroups={tagGroups}
            strategies={strategies}
            onUpdateBalance={handleUpdateBalance} 
         />;
       }
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard stats={stats} trades={filteredTrades} tagGroups={tagGroups} />;
      case 'calendar':
        return (
            <CalendarView 
                trades={filteredTrades} 
                currentMonth={currentCalendarMonth} 
                setCurrentMonth={setCurrentCalendarMonth}
                onDayClick={(dateStr) => {
                    setSelectedDailyDate(dateStr);
                }}
            />
        );
      case 'journal':
        return (
          <TradeList 
            trades={filteredTrades} 
            selectedAccountId={selectedAccountId}
            onTradeClick={navigateToTrade} 
            onDeleteTrade={(id) => handleRequestDelete([id])} 
            onDeleteTrades={handleRequestDelete} 
            onImportTrades={handleImportTrades}
            tagGroups={tagGroups} 
          />
        );
      case 'trash':
        return (
          <TradeList 
            trades={trashTrades}
            selectedAccountId={selectedAccountId}
            onTradeClick={() => {}} 
            onDeleteTrade={(id) => handleRequestDelete([id])} 
            onDeleteTrades={handleRequestDelete}
            isTrash={true}
            onRestoreTrades={handleRestoreTrades}
            tagGroups={tagGroups}
          />
        );
      case 'settings':
        return (
          <div className="p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Settings</h2>
            </div>
            
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6">
               <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">User Profile</h3>
                  <button onClick={() => setIsUserModalOpen(true)} className="text-primary text-sm hover:underline">Edit</button>
               </div>
               {user ? (
                   <div className="space-y-1">
                       <p className="text-sm"><span className="text-textMuted">Name:</span> {user.name}</p>
                       <p className="text-sm"><span className="text-textMuted">API Key:</span> {user.twelveDataApiKey ? '••••••••' : 'Not Set'}</p>
                   </div>
               ) : (
                   <p className="text-sm text-textMuted italic">No profile information set.</p>
               )}
            </div>

            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Trading Accounts</h3>
                  <button 
                    onClick={() => setIsAddAccountModalOpen(true)}
                    className="text-primary text-sm font-medium hover:underline"
                   >
                     + Add New Account
                   </button>
               </div>
               
               <ul className="space-y-2">
                 {accounts.map(acc => (
                   <li key={acc.id} className="flex justify-between items-center p-3 bg-background rounded border border-border hover:border-primary/50 transition-colors">
                     <div className="flex flex-col">
                        <span className="font-medium text-sm">{acc.name}</span>
                        <span className="text-xs text-textMuted">
                           {acc.type ? `${acc.type} Account` : (acc.isDemo ? 'Demo Account' : 'Real Account')} - {acc.currency}
                        </span>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className="text-textMuted font-mono text-sm">${acc.balance.toLocaleString()}</span>
                        <button 
                            onClick={() => handleRequestDeleteAccount(acc)}
                            className="text-textMuted hover:text-loss transition-colors p-1"
                            title="Delete Account"
                        >
                            <Trash2 size={16} />
                        </button>
                     </div>
                   </li>
                 ))}
                 {accounts.length === 0 && (
                     <li className="text-center py-4 text-textMuted text-sm italic">No accounts found.</li>
                 )}
               </ul>
            </div>
            
            <StrategyManager strategies={strategies} onUpdate={handleUpdateStrategies} />
            
            <TagManager groups={tagGroups} onUpdate={handleUpdateTags} />

            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm opacity-80 hover:opacity-100 transition-opacity mt-8">
                <h3 className="font-semibold mb-4 text-primary">Data Storage</h3>
                <p className="text-sm text-textMuted">Data is saved locally in your browser (LocalStorage) or connected database if configured.</p>
            </div>
          </div>
        );
      default:
        return <Dashboard stats={stats} trades={filteredTrades} tagGroups={tagGroups} />;
    }
  };

  const selectedTradeForView = trades.find(t => t.id === selectedTradeId);

  if (isLoading) {
      return (
          <div className="h-screen flex items-center justify-center bg-background text-textMain">
              <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-primary" size={48} />
                  <p className="text-textMuted font-medium">Loading Journal...</p>
              </div>
          </div>
      )
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={(tab) => { setActiveTab(tab); setSubView('list'); }}
      accounts={accounts} 
      selectedAccountId={selectedAccountId}
      setSelectedAccountId={setSelectedAccountId}
      onAddTradeClick={() => setIsAddModalOpen(true)}
      startDate={startDate}
      setStartDate={(d) => handleDateRangeChange(d, endDate)}
      endDate={endDate}
      setEndDate={(d) => handleDateRangeChange(startDate, d)}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
      onUpdateBalance={handleUpdateBalance}
    >
      {renderContent()}

      {selectedDailyDate && (
          <DailyViewModal 
            date={selectedDailyDate}
            trades={selectedDailyTrades}
            onClose={() => setSelectedDailyDate(null)}
            onTradeClick={navigateToTrade}
          />
      )}
      
      {isViewModalOpen && selectedTradeForView && (
          <TradeViewModal 
              trade={selectedTradeForView}
              account={accounts.find(a => a.id === selectedTradeForView.accountId)}
              onClose={() => setIsViewModalOpen(false)}
              onEdit={handleEditFromModal}
              onDelete={() => handleRequestDelete([selectedTradeForView.id])} 
              onSave={handleSaveTrade}
              tagGroups={tagGroups}
              onUpdateBalance={handleUpdateBalance}
          />
      )}

      {isAddAccountModalOpen && (
          <AddAccountModal 
            onSave={handleAddAccount}
            onClose={() => setIsAddAccountModalOpen(false)}
          />
      )}

      {isUserModalOpen && (
          <UserModal 
            user={user}
            onSave={handleUserUpdate}
            onClose={() => setIsUserModalOpen(false)}
          />
      )}

      <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          count={tradesToDelete.length}
          tradeSymbol={tradesToDelete.length === 1 ? trades.find(t => t.id === tradesToDelete[0])?.symbol : undefined}
          onConfirm={executeDelete}
          onCancel={() => setIsDeleteModalOpen(false)}
      />

      {accountToDelete && (
          <DeleteAccountModal 
              accountToDelete={accountToDelete}
              otherAccounts={accounts.filter(a => a.id !== accountToDelete.id)}
              onClose={() => setAccountToDelete(null)}
              onConfirm={handleExecuteDeleteAccount}
          />
      )}

      {isAddModalOpen && (
        <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-border flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold">Add Trade</h3>
              <div className="flex items-center gap-3">
                 <button onClick={() => setIsAddModalOpen(false)} className="text-textMuted hover:text-textMain"><X size={20} /></button>
              </div>
            </div>
            
            <div className="px-5 py-3 border-b border-border flex justify-between items-start shrink-0 bg-surface z-10">
              <div className="flex gap-2">
                <input 
                    type="file" 
                    ref={analysisFileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleAnalysisFileUpload}
                />
                <button 
                    type="button" 
                    onClick={() => analysisFileInputRef.current?.click()}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 px-2 py-1 bg-surfaceHighlight hover:bg-border text-xs font-medium text-textMain rounded border border-border transition-colors disabled:opacity-50"
                >
                    {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Upload
                </button>
                <button 
                    type="button"
                    onClick={handleClipboardAnalysis}
                    disabled={isAnalyzing}
                    className="flex items-center gap-1.5 px-2 py-1 bg-surfaceHighlight hover:bg-border text-xs font-medium text-textMain rounded border border-border transition-colors disabled:opacity-50"
                >
                    {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Clipboard size={12} />}
                    Clipboard
                </button>
              </div>

              <div className="flex flex-col items-end">
                  <span className="text-[10px] text-textMuted uppercase tracking-wider font-semibold mb-0.5">Account Balance</span>
                  <div className="group flex items-center gap-1 cursor-text transition-colors" onClick={() => document.getElementById('balanceInput')?.focus()}>
                      <span className="text-sm font-medium text-textMuted">$</span>
                      <input 
                          id="balanceInput"
                          type="number" 
                          step="any"
                          value={newTradeForm.balance || ''} 
                          onChange={(e) => setNewTradeForm({...newTradeForm, balance: e.target.value})} 
                          className="bg-transparent border-b border-dashed border-textMuted/30 hover:border-primary focus:border-primary focus:outline-none w-24 text-right text-sm font-mono font-bold text-textMain transition-colors p-0 rounded-none"
                          placeholder="0.00"
                      />
                  </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <form id="add-trade-form" onSubmit={handleQuickAdd} className="p-5 pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Asset Pair</label>
                      <div className="relative">
                          <select
                              name="symbol"
                              onChange={(e) => setNewTradeForm({...newTradeForm, symbol: e.target.value})}
                              className="w-full bg-background border border-border rounded p-2 text-sm text-textMain uppercase appearance-none"
                              required
                              value={newTradeForm.symbol || 'XAUUSD'}
                          >
                              <option value="" disabled></option>
                              {ASSETS.map(asset => (
                                  <option key={asset.id} value={asset.assetPair}>{asset.assetPair}</option>
                              ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none" size={14} />
                      </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-1 flex items-center justify-between">
                            Current Price 
                        </label>
                        <div className="flex flex-col relative">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                type="number" 
                                step="any" 
                                value={newTradeForm.currentPrice || ''} 
                                onChange={(e) => setNewTradeForm({...newTradeForm, currentPrice: e.target.value})} 
                                className={`w-full bg-background border rounded p-2 text-sm text-textMain transition-all ${isFetchingPrice ? 'opacity-70' : ''} ${priceError ? 'border-loss' : 'border-border'}`}
                                placeholder="0.00"
                                disabled={isFetchingPrice}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); fetchLatestPrice(newTradeForm.symbol); }}
                                className={`px-3 bg-surfaceHighlight hover:bg-border border rounded text-primary transition-colors flex items-center justify-center ${priceError ? 'border-loss text-loss' : 'border-border'}`}
                                title="Refresh Price"
                                disabled={isFetchingPrice}
                            >
                                {isFetchingPrice ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <RefreshCw size={16} />}
                            </button>
                          </div>
                          {priceError && (
                              <span className="text-[10px] text-loss absolute -bottom-4 left-0">{priceError}</span>
                          )}
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Entry Price</label>
                        <input type="number" step="any" value={newTradeForm.entryPrice || ''} onChange={(e) => setNewTradeForm({...newTradeForm, entryPrice: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain" required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Leverage</label>
                        <input type="number" step="any" value={newTradeForm.leverage || ''} onChange={(e) => setNewTradeForm({...newTradeForm, leverage: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Take Profit</label>
                        <input type="number" step="any" value={newTradeForm.takeProfit || ''} onChange={(e) => setNewTradeForm({...newTradeForm, takeProfit: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain" required />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Stop Loss</label>
                        <input type="number" step="any" value={newTradeForm.stopLoss || ''} onChange={(e) => setNewTradeForm({...newTradeForm, stopLoss: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={`block text-xs font-medium mb-1 ${!canCalculateRisk ? 'text-textMuted/50' : 'text-textMuted'}`}>Lot Size</label>
                        <input 
                          type="number" 
                          step="any" 
                          value={newTradeForm.quantity || ''}
                          onChange={(e) => handleLotSizeChange(e.target.value)} 
                          className={`w-full bg-background border border-border rounded p-2 text-sm text-textMain ${!canCalculateRisk ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!canCalculateRisk}
                          required 
                        />
                    </div>
                    <div>
                        <label className={`block text-xs font-medium mb-1 ${!canCalculateRisk ? 'text-textMuted/50' : 'text-textMuted'}`}>Risk %</label>
                        <input 
                          type="number" 
                          step="any" 
                          value={newTradeForm.riskPercentage || ''}
                          onChange={(e) => handleRiskPctChange(e.target.value)} 
                          className={`w-full bg-background border border-border rounded p-2 text-sm text-textMain ${!canCalculateRisk ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={!canCalculateRisk}
                        />
                    </div>
                  </div>
                  {!canCalculateRisk && (
                      <p className="text-[10px] text-orange-500/80 mt-[-10px]">* Fill Asset, Entry, SL, and Balance to enable calculators.</p>
                  )}
                  
                  {isFormComplete && tradeCalculations && (
                      <div className="bg-surfaceHighlight/50 border border-border rounded-lg p-3 space-y-3 text-xs">
                          <div className="grid grid-cols-2 border-b border-border/50 pb-2">
                            <div>
                              <span className="text-textMuted font-medium text-[10px] uppercase block mb-1">Direction</span>
                              <span className={`font-bold flex items-center gap-1 ${tradeCalculations.direction === 'LONG' ? 'text-profit' : 'text-loss'}`}>
                                  {tradeCalculations.direction === 'LONG' ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                                  {tradeCalculations.direction}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-textMuted font-medium text-[10px] uppercase block mb-1">Order Type</span>
                              <span className="font-bold text-textMain">{tradeCalculations.orderType}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                              <div className="flex flex-col gap-0.5">
                                  <span className="text-textMuted text-[10px] uppercase">Take Profit</span>
                                  <div className="font-mono text-textMain">
                                      {tradeCalculations.tpCalc.points.toFixed(2)} Pts <span className="text-textMuted">|</span> {tradeCalculations.tpCalc.pips.toFixed(1)} Pips
                                  </div>
                                  <div className="font-mono text-[10px] text-textMuted">
                                      {tradeCalculations.tpCalc.ticks.toFixed(0)} Ticks
                                  </div>
                              </div>
                              
                              <div className="flex flex-col gap-0.5 text-right">
                                  <span className="text-textMuted text-[10px] uppercase">Stop Loss</span>
                                  <div className="font-mono text-textMain">
                                      {tradeCalculations.slCalc.points.toFixed(2)} Pts <span className="text-textMuted">|</span> {tradeCalculations.slCalc.pips.toFixed(1)} Pips
                                  </div>
                                  <div className="font-mono text-[10px] text-textMuted">
                                      {tradeCalculations.slCalc.ticks.toFixed(0)} Ticks
                                  </div>
                              </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                              <div>
                                  <div className="text-[10px] text-textMuted uppercase mb-0.5">Risk</div>
                                  <div className="font-bold text-loss">${tradeCalculations.riskAmount.toFixed(2)}</div>
                              </div>
                              <div className="text-center">
                                  <div className="text-[10px] text-textMuted uppercase mb-0.5">Reward</div>
                                  <div className="font-bold text-profit">${tradeCalculations.potentialProfit.toFixed(2)}</div>
                              </div>
                              <div className="text-right">
                                  <div className="text-[10px] text-textMuted uppercase mb-0.5">RR Ratio</div>
                                  <div className="font-bold text-primary">1:{tradeCalculations.rr.toFixed(2)}</div>
                              </div>
                          </div>
                          
                          <div className="flex justify-between items-center bg-background p-2 rounded border border-border/50">
                              <span className="text-textMuted flex items-center gap-1"><Calculator size={10}/> Margin</span>
                              <span className="font-mono font-medium">${tradeCalculations.requiredMargin.toFixed(2)}</span>
                          </div>
                      </div>
                  )}
                  
                  <div className="bg-surface border border-border rounded-lg p-2 mt-2">
                      <h4 className="text-[10px] font-bold mb-1.5 flex justify-between items-center text-textMuted uppercase tracking-wider">
                          Trade Screenshots
                          <span className="text-[9px] bg-surfaceHighlight px-1.5 py-0.5 rounded text-textMuted">Paste enabled (Ctrl+V)</span>
                      </h4>
                      
                      <div className="space-y-1.5">
                        {newTradeForm.screenshots && newTradeForm.screenshots.length > 0 && (
                            <div className="grid grid-cols-5 gap-1.5 mb-2">
                              {newTradeForm.screenshots.map((url: string, idx: number) => (
                                <div key={idx} className="relative group rounded overflow-hidden border border-border h-10 w-full bg-background">
                                  <img src={url} alt={`Screenshot ${idx}`} className="w-full h-full object-cover" />
                                  <button 
                                    type="button"
                                    onClick={() => handleRemoveImage(idx)}
                                    className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-red-600 text-white p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 size={8} />
                                  </button>
                                </div>
                              ))}
                            </div>
                        )}

                        <div className="flex gap-1.5">
                            <div className="relative flex-1">
                              <input 
                                  type="file" 
                                  ref={fileInputRef} 
                                  className="hidden" 
                                  accept="image/*"
                                  onChange={handleFileUpload}
                              />
                              <button 
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full py-1 bg-surfaceHighlight/50 hover:bg-surfaceHighlight text-textMuted hover:text-textMain border border-border border-dashed rounded text-[10px] flex items-center justify-center gap-1.5 transition-colors h-7"
                              >
                                  <Upload size={10} /> Upload
                              </button>
                            </div>

                            <div className="flex gap-1 flex-[1.5]">
                              <input 
                                type="text" 
                                value={newImageUrl} 
                                onChange={(e) => setNewImageUrl(e.target.value)} 
                                placeholder="Image URL..."
                                className="flex-1 bg-background border border-border rounded px-2 py-1 text-[10px] text-textMain focus:outline-none focus:border-primary h-7"
                              />
                              <button 
                                  type="button"
                                  onClick={handleAddImageFromUrl} 
                                  className="px-2 bg-surfaceHighlight hover:bg-border rounded text-primary border border-border h-7 flex items-center justify-center"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                        </div>
                      </div>
                  </div>

                  <div className="mt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsNotesOpen(!isNotesOpen)}
                      className="flex items-center justify-between w-full py-2 text-xs font-medium text-textMuted hover:text-textMain border-b border-border transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        Notes & Tags
                        {(newTradeForm.tags?.length > 0 || newTradeForm.notes || newTradeForm.emotionalNotes) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                        )}
                      </span>
                      {isNotesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isNotesOpen && (
                      <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div>
                          <label className="block text-xs font-medium text-textMuted mb-1">Technical Notes</label>
                          <textarea 
                            value={newTradeForm.notes || ''} 
                            onChange={(e) => setNewTradeForm({...newTradeForm, notes: e.target.value})} 
                            className="w-full bg-background border border-border rounded p-2 text-sm text-textMain min-h-[60px]" 
                            placeholder="Setup / Strategy, Why is trade taken, and other technical notes"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-textMuted mb-1">Emotional Notes</label>
                          <textarea 
                            value={newTradeForm.emotionalNotes || ''} 
                            onChange={(e) => setNewTradeForm({...newTradeForm, emotionalNotes: e.target.value})} 
                            className="w-full bg-background border border-border rounded p-2 text-sm text-textMain min-h-[60px]" 
                            placeholder="Explain Emotional feeling when taking trade"
                          />
                        </div>

                        <div className="border-t border-border pt-3">
                          <div className="flex justify-between items-center mb-2">
                              <label className="block text-xs font-medium text-textMuted">Tags</label>
                              <span className="text-[10px] text-textMuted">{newTradeForm.tags?.length || 0} selected</span>
                          </div>

                          {newTradeForm.tags && newTradeForm.tags.length > 0 && (
                              <div className="mb-3">
                                  <div className="flex flex-wrap gap-1.5 p-2 bg-surfaceHighlight/30 rounded-lg border border-border/50 min-h-[36px]">
                                  {newTradeForm.tags.map((tag: string) => (
                                      <button
                                          key={tag}
                                          type="button"
                                          onClick={() => toggleTag(tag)}
                                          className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded border border-primary/20 hover:bg-loss/10 hover:text-loss hover:border-loss/30 transition-colors group"
                                          title="Remove tag"
                                      >
                                          {tag}
                                          <X size={10} className="opacity-70 group-hover:opacity-100" />
                                      </button>
                                  ))}
                                  </div>
                              </div>
                          )}

                          <div className="space-y-3">
                              {tagGroups.map(group => (
                              <div key={group.name}>
                                  <h5 className="text-[10px] text-textMuted uppercase font-bold mb-1.5">{group.name}</h5>
                                  <div className="flex flex-wrap gap-1.5">
                                  {group.tags.map(tag => (
                                      <button
                                      type="button"
                                      key={tag}
                                      onClick={() => toggleTag(tag)}
                                      className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                                          newTradeForm.tags?.includes(tag)
                                          ? 'bg-primary/20 border-primary text-primary opacity-50 cursor-default'
                                          : 'bg-surface border-border text-textMuted hover:border-textMuted'
                                      }`}
                                      >
                                      {tag}
                                      </button>
                                  ))}
                                  </div>
                              </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}
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
      )}
    </Layout>
  );
}

export default App;