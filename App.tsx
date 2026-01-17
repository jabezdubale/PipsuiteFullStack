
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import TradeList from './components/TradeList';
import CalendarView from './components/CalendarView';
import TradeDetail from './components/TradeDetail';
import TradeViewModal from './components/TradeViewModal';
import DailyViewModal from './components/DailyViewModal';
import WeeklyViewModal from './components/WeeklyViewModal';
import AddAccountModal from './components/AddAccountModal';
import DeleteConfirmationModal from './components/DeleteConfirmationModal';
import DeleteAccountModal from './components/DeleteAccountModal';
import TagManager from './components/TagManager';
import StrategyManager from './components/StrategyManager';
import { getTrades, saveTrade, deleteTrades, trashTrades, restoreTrades, getAccounts, saveAccount, deleteAccount, getTagGroups, saveTagGroups, getStrategies, saveStrategies, saveTrades, getSetting, saveSetting, getUsers, saveUser, deleteUser, adjustAccountBalance, uploadImage, deleteBlobImages } from './services/storageService';
import { fetchCurrentPrice, PriceResult } from './services/priceService';
import { extractTradeParamsFromImage } from './services/geminiService';
import { Trade, TradeStats, Account, TradeType, TradeStatus, ASSETS, TagGroup, OrderType, Session, TradeOutcome, User } from './types';
import { X, ChevronDown, Calculator, TrendingUp, TrendingDown, RefreshCw, Loader2, Upload, Plus, Trash2, Clipboard, ChevronUp, Eraser, User as UserIcon, Database } from 'lucide-react';
import UserModal from './components/UserModal';
import { compressImage, addScreenshot } from './utils/imageUtils';
import { generateId } from './utils/idUtils';
import { exportTradesToCSV } from './utils/csvExport';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); 
  const [subView, setSubView] = useState<'list' | 'detail'>('list'); 
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Selection State
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Calendar State
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  // Daily/Weekly View State
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<{ start: string; end: string } | null>(null);
  const [selectedWeekTrades, setSelectedWeekTrades] = useState<Trade[]>([]);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false); 
  const [editingUser, setEditingUser] = useState<User | null>(null); 

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tradesToDelete, setTradesToDelete] = useState<string[]>([]);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Price Fetching State
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [priceSource, setPriceSource] = useState<PriceResult | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  // AI Analysis & Upload State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [newTradeForm, setNewTradeForm] = useState<any>({ symbol: 'XAUUSD', screenshots: [], tags: [], setup: '' });
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analysisFileInputRef = useRef<HTMLInputElement>(null);

  // Initial Data Load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load Users first
        const loadedUsers = await getUsers();
        setUsers(loadedUsers);

        // Determine Current User
        let userToSelect = loadedUsers[0]; 
        const savedUserId = localStorage.getItem('pipsuite_current_user_id');
        if (savedUserId) {
            const found = loadedUsers.find(u => u.id === savedUserId);
            if (found) userToSelect = found;
        }
        
        if (userToSelect) {
            await handleSwitchUser(userToSelect.id, loadedUsers);
        } else {
            // Fallback load if no users (legacy mode)
            const [loadedAccounts, loadedTrades, loadedTags, loadedStrategies] = await Promise.all([
              getAccounts(),
              getTrades(),
              getTagGroups(),
              getStrategies()
            ]);
            setAccounts(loadedAccounts);
            setTrades(loadedTrades);
            setTagGroups(loadedTags);
            setStrategies(loadedStrategies);
            if (loadedAccounts.length > 0 && !selectedAccountId) {
                setSelectedAccountId(loadedAccounts[0].id);
            }
        }

      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSwitchUser = async (userId: string, userList = users) => {
      const newUser = userList.find(u => u.id === userId);
      if (!newUser) return;

      setCurrentUser(newUser);
      localStorage.setItem('pipsuite_current_user_id', newUser.id);

      // Load User Scoped Data - Pass userId to getTrades to filter server-side
      const [userAccounts, userTrades, userTags, userStrategies] = await Promise.all([
          getAccounts(userId),
          getTrades(userId), 
          getTagGroups(userId),
          getStrategies(userId)
      ]);

      setAccounts(userAccounts);
      setTrades(userTrades);
      setTagGroups(userTags);
      setStrategies(userStrategies);

      if (userAccounts.length > 0) {
          const savedAccountId = localStorage.getItem(`pipsuite_selected_account_${userId}`);
          if (savedAccountId && userAccounts.some(a => a.id === savedAccountId)) {
              setSelectedAccountId(savedAccountId);
          } else {
              setSelectedAccountId(userAccounts[0].id);
          }
      } else {
          setSelectedAccountId('');
      }
  };

  const handleUserSave = async (userData: Partial<User>) => {
      try {
          const userToSave: User = {
              id: editingUser ? editingUser.id : generateId('user'),
              name: userData.name!,
              geminiApiKey: userData.geminiApiKey!,
              twelveDataApiKey: userData.twelveDataApiKey!
          };

          await saveUser(userToSave);
          const updatedUsers = await getUsers();
          setUsers(updatedUsers);

          if (!editingUser) {
              const defaultAccount: Account = {
                  id: generateId('acc'),
                  userId: userToSave.id,
                  name: "First Account",
                  currency: 'USD',
                  balance: 0,
                  isDemo: false,
                  type: 'Real'
              };
              await saveAccount(defaultAccount);
              await handleSwitchUser(userToSave.id, updatedUsers);
          } else {
              if (currentUser?.id === userToSave.id) {
                  setCurrentUser(userToSave); 
              }
          }
      } catch (e) {
          alert("Failed to save user.");
      }
  };

  const handleUserDelete = async (userId: string) => {
      if (!window.confirm("Are you sure you want to delete this user? All associated data will be lost.")) return;
      try {
          await deleteUser(userId);
          const updatedUsers = await getUsers();
          setUsers(updatedUsers);
          // If we deleted the current user
          if (currentUser?.id === userId) {
             if (updatedUsers.length > 0) {
                 handleSwitchUser(updatedUsers[0].id, updatedUsers);
             } else {
                 setCurrentUser(null);
                 setAccounts([]);
                 setTrades([]);
                 setSelectedAccountId('');
             }
          }
      } catch (e) {
          alert("Failed to delete user.");
      }
  };

  const handleAccountChange = (accountId: string) => {
      setSelectedAccountId(accountId);
      if (currentUser) {
          localStorage.setItem(`pipsuite_selected_account_${currentUser.id}`, accountId);
      }
  };

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
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isAddModalOpen) return; // Only listen when modal is open

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            try {
                setIsUploading(true);
                // Compress before upload
                const base64 = await compressImage(blob);
                // Upload to Vercel Blob with unique name
                const uniqueName = `pasted_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
                const url = await uploadImage(uniqueName, base64);
                
                setNewTradeForm((prev: any) => {
                    try {
                        return { ...prev, screenshots: addScreenshot(prev.screenshots || [], url) };
                    } catch (e: any) {
                        alert(e?.message || 'Unable to add screenshot.');
                        return prev;
                    }
                });
            } catch(e) {
                console.error(e);
                alert("Failed to upload image.");
            } finally {
                setIsUploading(false);
            }
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
    if (!currentUser?.geminiApiKey) {
        alert("Please set your Gemini API Key in User Settings.");
        return;
    }
    setIsAnalyzing(true);
    try {
        const extractedData = await extractTradeParamsFromImage(base64, currentUser.geminiApiKey);
        
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
          compressImage(file).then(base64 => {
              handleAnalyzeImage(base64);
          });
      }
  };

  const handleClipboardAnalysis = async () => {
      try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
              const imageType = item.types.find(type => type.startsWith('image/'));
              if (imageType) {
                  const blob = await item.getType(imageType);
                  const base64 = await compressImage(blob);
                  handleAnalyzeImage(base64);
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
      if (!currentUser?.twelveDataApiKey) {
          setPriceError("API Key Missing");
          return;
      }
      setIsFetchingPrice(true);
      setPriceSource(null);
      setPriceError(null);
      
      try {
          const result = await fetchCurrentPrice(symbol, currentUser.twelveDataApiKey);
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

  // Trades Filtering - Global Date Filter Removed
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      // Exclude deleted trades from main view
      if (t.isDeleted) return false;
      
      // Filter only by Account
      const accountMatch = t.accountId === selectedAccountId;
      
      return accountMatch;
    });
  }, [trades, selectedAccountId]);

  const trashTradesList = useMemo(() => {
      return trades.filter(t => t.isDeleted && t.accountId === selectedAccountId);
  }, [trades, selectedAccountId]);

  const selectedDailyTrades = useMemo(() => {
      if (!selectedDailyDate) return [];
      return trades.filter(t => {
          if (t.isDeleted) return false;
          // Use Entry Time (entryDate) as primary date
          // Fix: Ensure we match the local date string format from calendar
          const tDate = new Date(t.entryDate || t.createdAt);
          const y = tDate.getFullYear();
          const m = (tDate.getMonth() + 1).toString().padStart(2, '0');
          const d = tDate.getDate().toString().padStart(2, '0');
          const dateKey = `${y}-${m}-${d}`;
          
          return dateKey === selectedDailyDate && t.accountId === selectedAccountId;
      });
  }, [trades, selectedDailyDate, selectedAccountId]);


  // Stats
  const stats: TradeStats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    
    // Only calculate stats on CLOSED trades to avoid skewing win rate
    const closedTrades = filteredTrades.filter(t => t.outcome === TradeOutcome.CLOSED);

    if (totalTrades === 0) {
      return { totalTrades: 0, winRate: 0, netPnL: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, bestTrade: 0, worstTrade: 0 };
    }

    const wins = closedTrades.filter(t => t.pnl > 0);
    const losses = closedTrades.filter(t => t.pnl <= 0); // Open trades are excluded by the closedTrades filter
    
    const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    
    // Net PnL includes partials from open trades? Usually yes, but here we strictly follow dashboard logic
    // If dashboard shows open trades in list, stats usually reflect closed.
    // If we want Net PnL to include everything, use filteredTrades.
    // But for WinRate/AvgWin/Loss, use closed.
    
    const allNetPnL = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const avgWin = wins.length ? totalWinPnl / wins.length : 0;
    const avgLoss = losses.length ? totalLossPnl / losses.length : 0;
    const profitFactor = totalLossPnl === 0 ? totalWinPnl : totalWinPnl / totalLossPnl;
    
    const bestTrade = Math.max(...filteredTrades.map(t => t.pnl), 0);
    const worstTrade = Math.min(...filteredTrades.map(t => t.pnl), 0);

    return { totalTrades, winRate, netPnL: allNetPnL, avgWin, avgLoss, profitFactor, bestTrade, worstTrade };
  }, [filteredTrades]);

  // --- Async Handlers ---

  const handleSaveTrade = async (trade: Trade, shouldClose: boolean = true, balanceChange: number = 0) => {
    try {
        const savedTrade = await saveTrade(trade, balanceChange);
        
        // Optimistically update local state to avoid UI wipe
        setTrades(prev => {
            const exists = prev.find(t => t.id === savedTrade.id);
            if (exists) {
                return prev.map(t => t.id === savedTrade.id ? savedTrade : t);
            }
            return [savedTrade, ...prev];
        });
        
        // If balance changed, refresh accounts
        if (balanceChange !== 0 && currentUser) {
            const freshAccounts = await getAccounts(currentUser.id);
            setAccounts(freshAccounts);
        }
        
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
          await saveTrades(newTrades);
          // Refetch to keep client state consistent
          if (currentUser) {
              const freshTrades = await getTrades(currentUser.id);
              setTrades(freshTrades);
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
              await deleteTrades(tradesToDelete);
              setTrades(prev => prev.filter(t => !tradesToDelete.includes(t.id)));
          } else {
              // Trash trades (Atomic backend call)
              const updatedTrades = await trashTrades(tradesToDelete, selectedAccountId);
              
              // Merge updates into local state
              setTrades(prev => prev.map(t => {
                  const updated = updatedTrades.find(ut => ut.id === t.id);
                  return updated ? updated : t;
              }));
              
              // Refresh accounts as balance might change
              if (currentUser) {
                  const freshAccounts = await getAccounts(currentUser.id);
                  setAccounts(freshAccounts);
              }
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

  const handleTrashTradesFromModal = async (ids: string[]) => {
      try {
          const updatedTrades = await trashTrades(ids, selectedAccountId);
          // Merge updates
          setTrades(prev => prev.map(t => {
              const updated = updatedTrades.find(ut => ut.id === t.id);
              return updated ? updated : t;
          }));
          
          if (currentUser) {
              const freshAccounts = await getAccounts(currentUser.id);
              setAccounts(freshAccounts);
          }
      } catch (e) {
          console.error(e);
          alert("Failed to delete trades.");
      }
  };

  const handleRestoreTrades = async (ids: string[]) => {
      try {
          const updatedTrades = await restoreTrades(ids, selectedAccountId);
          
          setTrades(prev => prev.map(t => {
              const updated = updatedTrades.find(ut => ut.id === t.id);
              return updated ? updated : t;
          }));
          
          if (currentUser) {
              const freshAccounts = await getAccounts(currentUser.id);
              setAccounts(freshAccounts);
          }

      } catch (e) {
          console.error(e);
          alert("Failed to restore trades.");
      }
  };

  const handleAddAccount = async (accountData: Account) => {
      if (!currentUser) return;
      const account: Account = { ...accountData, userId: currentUser.id };
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

  const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw', accountId?: string) => {
      const targetAccountId = accountId || selectedAccountId;
      const adjustment = type === 'deposit' ? amount : -amount;
      try {
        const updatedAccounts = await adjustAccountBalance(targetAccountId, adjustment);
        setAccounts(updatedAccounts);
      } catch(e) {
        alert("Failed to update balance.");
      }
  };

  const handleUpdateTags = async (newGroups: TagGroup[]) => {
      if (!currentUser) return;
      try {
          const updated = await saveTagGroups(newGroups, currentUser.id);
          setTagGroups(updated);
      } catch (e) {
          alert("Failed to update tags");
      }
  };

  const handleCleanupTag = async (tag: string) => {
      // Remove tag from all trades locally and save
      const affectedTrades = trades.filter(t => t.tags.includes(tag));
      const updatedTrades = affectedTrades.map(t => ({
          ...t,
          tags: t.tags.filter(tg => tg !== tag)
      }));
      
      try {
          if (updatedTrades.length > 0) {
              // This still uses the batch update
              await saveTrades(updatedTrades);
              // Update local state
              setTrades(prev => prev.map(t => {
                  const updated = updatedTrades.find(ut => ut.id === t.id);
                  return updated || t;
              }));
          }
      } catch (e) {
          alert("Failed to clean up tags from trades.");
      }
  };

  const handleUpdateStrategies = async (newStrategies: string[]) => {
      if (!currentUser) return;
      try {
          const updated = await saveStrategies(newStrategies, currentUser.id);
          setStrategies(updated);
      } catch (e) {
          alert("Failed to update strategies");
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
          setIsUploading(true);
          const base64String = await compressImage(file);
          const uniqueName = `pasted_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
          const url = await uploadImage(uniqueName, base64String);
          setNewTradeForm((prev: any) => {
              try {
                  return { ...prev, screenshots: addScreenshot(prev.screenshots || [], url) };
              } catch (e: any) {
                  alert(e?.message || 'Unable to add screenshot.');
                  return prev;
              }
          });
      } catch (err) {
          console.error(err);
          alert("Error processing image.");
      } finally {
          setIsUploading(false);
      }
    }
  };

  const handleAddImageFromUrl = () => {
      if (newImageUrl) {
          setNewTradeForm((prev: any) => {
              try {
                  return { ...prev, screenshots: addScreenshot(prev.screenshots || [], newImageUrl) };
              } catch (e: any) {
                  alert(e?.message || 'Unable to add screenshot.');
                  return prev;
              }
          });
          setNewImageUrl('');
      }
  }

  const handleRemoveImage = async (index: number) => {
      const urlToRemove = newTradeForm.screenshots[index];
      if (urlToRemove) {
          try {
              // Best-effort delete from Vercel Blob
              await deleteBlobImages([urlToRemove]);
          } catch (e) {
              console.error("Failed to delete blob:", e);
          }
      }
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
      id: generateId('trade'),
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
            onUpdateBalance={(amount, type) => handleUpdateBalance(amount, type, trade.accountId)}
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
                onWeekClick={(start, end, trades) => {
                    setSelectedWeek({ start, end });
                    setSelectedWeekTrades(trades);
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
            trades={trashTradesList}
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
        // ... (settings render code remains unchanged)
        return (
          <div className="p-8 max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h2 className="text-xl font-bold">Settings</h2>
            
            {/* User Management Section */}
            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6">
               <div className="flex justify-between items-center pb-2 border-b border-border/50">
                  <h3 className="font-semibold flex items-center gap-2">
                      <UserIcon size={18} className="text-primary" /> User Management
                  </h3>
                  <button 
                    onClick={() => { setEditingUser(null); setIsUserModalOpen(true); }}
                    className="text-xs bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors font-bold flex items-center gap-1"
                  >
                      <Plus size={14} /> Add User
                  </button>
               </div>
               <div className="space-y-2">
                   {users.map(u => {
                       const isCurrent = currentUser?.id === u.id;
                       return (
                           <div key={u.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isCurrent ? 'bg-primary/5 border-primary/30' : 'bg-background border-border hover:border-primary/20'}`}>
                               <div className="flex items-center gap-3">
                                   <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-primary text-white' : 'bg-surfaceHighlight text-textMuted'}`}>
                                       {u.name.charAt(0).toUpperCase()}
                                   </div>
                                   <div>
                                       <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-textMain'}`}>
                                           {u.name} {isCurrent && <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded ml-2">Active</span>}
                                       </p>
                                   </div>
                               </div>
                               <div className="flex items-center gap-2">
                                   {!isCurrent && <button onClick={() => handleSwitchUser(u.id, users)} className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded transition-colors text-xs font-medium">Select</button>}
                                   <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }} className="p-1.5 text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded transition-colors"><Eraser size={14} /></button>
                                   {!isCurrent && <button onClick={() => handleUserDelete(u.id)} className="p-1.5 text-textMuted hover:text-loss hover:bg-loss/10 rounded transition-colors"><Trash2 size={14} /></button>}
                               </div>
                           </div>
                       );
                   })}
               </div>
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
            
            <TagManager groups={tagGroups} onUpdate={handleUpdateTags} onCleanupTag={handleCleanupTag} />

            <div className="bg-surface border border-border rounded-xl p-6 shadow-sm opacity-80 hover:opacity-100 transition-opacity mt-8">
                <h3 className="font-semibold mb-4 text-primary flex items-center gap-2"><Database size={16}/> Data Storage</h3>
                <p className="text-sm text-textMuted leading-relaxed mb-4">
                    Your trades, accounts, and journal entries are securely stored in the <strong>Database</strong>.
                </p>
                <div className="text-xs text-textMuted bg-surfaceHighlight/30 p-4 rounded-lg border border-border/50">
                    <p className="font-semibold mb-2 text-textMain">Local Browser Storage (LocalStorage) is used for:</p>
                    <ul className="list-disc pl-4 space-y-1.5 opacity-90">
                        <li>Selected User Profile & Account</li>
                        <li>Dashboard Layout & Widget Visibility</li>
                        <li>Trade List Column Preferences</li>
                        <li>Active Filters (Tags, Date ranges)</li>
                    </ul>
                    <p className="mt-3 opacity-70 italic border-t border-border/30 pt-2">
                        Clearing your browser cache will reset these display preferences, but your trading data will remain safe.
                    </p>
                </div>
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
      setSelectedAccountId={handleAccountChange}
      onAddTradeClick={() => setIsAddModalOpen(true)}
      toggleTheme={() => setIsDarkMode(!isDarkMode)}
      isDarkMode={isDarkMode}
      onUpdateBalance={(amount, type) => handleUpdateBalance(amount, type, selectedAccountId)}
      users={users}
      currentUser={currentUser}
      onSwitchUser={(id) => handleSwitchUser(id, users)}
    >
      {renderContent()}

      {selectedDailyDate && (
          <DailyViewModal 
            date={selectedDailyDate}
            trades={selectedDailyTrades}
            onClose={() => setSelectedDailyDate(null)}
            onTradeClick={navigateToTrade}
            onTrashTrades={handleTrashTradesFromModal}
            onExportTrades={exportTradesToCSV}
          />
      )}

      {selectedWeek && (
          <WeeklyViewModal 
            startDate={selectedWeek.start}
            endDate={selectedWeek.end}
            trades={selectedWeekTrades}
            onClose={() => setSelectedWeek(null)}
            onTradeClick={navigateToTrade}
            onTrashTrades={handleTrashTradesFromModal}
            onExportTrades={exportTradesToCSV}
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
              onUpdateBalance={(amount, type) => handleUpdateBalance(amount, type, selectedTradeForView.accountId)}
          />
      )}

      {isAddAccountModalOpen && currentUser && (
          <AddAccountModal 
            userId={currentUser.id}
            onSave={handleAddAccount}
            onClose={() => setIsAddAccountModalOpen(false)}
          />
      )}

      {isUserModalOpen && (
          <UserModal 
            user={editingUser}
            onSave={handleUserSave}
            onClose={() => setIsUserModalOpen(false)}
          />
      )}

      <DeleteConfirmationModal
          isOpen={isDeleteModalOpen}
          count={tradesToDelete.length}
          tradeSymbol={tradesToDelete.length === 1 ? trades.find(t => t.id === tradesToDelete[0])?.symbol : undefined}
          onConfirm={executeDelete}
          onCancel={() => setIsDeleteModalOpen(false)}
          mode={activeTab === 'trash' ? 'permanent' : 'soft'}
      />

      {accountToDelete && (
          <DeleteAccountModal 
              accountToDelete={accountToDelete}
              otherAccounts={accounts.filter(a => a.id !== accountToDelete.id)}
              onClose={() => setAccountToDelete(null)}
              onConfirm={handleExecuteDeleteAccount}
          />
      )}

      {/* ... Add Trade Modal XML ... */}
      {isAddModalOpen && (
        <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsAddModalOpen(false)}
        >
          {/* ... Content of Add Trade Modal ... */}
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
                    disabled={isAnalyzing || isUploading}
                    className="flex items-center gap-1.5 px-2 py-1 bg-surfaceHighlight hover:bg-border text-xs font-medium text-textMain rounded border border-border transition-colors disabled:opacity-50"
                >
                    {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Analyze
                </button>
                <button 
                    type="button"
                    onClick={handleClipboardAnalysis}
                    disabled={isAnalyzing || isUploading}
                    className="flex items-center gap-1.5 px-2 py-1 bg-surfaceHighlight hover:bg-border text-xs font-medium text-textMain rounded border border-border transition-colors disabled:opacity-50"
                >
                    {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Clipboard size={12} />}
                    Paste & Analyze
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
                  {/* ... Rest of form ... */}
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
                          {/* ... Calc UI ... */}
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
                              </div>
                              <div className="flex flex-col gap-0.5 text-right">
                                  <span className="text-textMuted text-[10px] uppercase">Stop Loss</span>
                                  <div className="font-mono text-textMain">
                                      {tradeCalculations.slCalc.points.toFixed(2)} Pts <span className="text-textMuted">|</span> {tradeCalculations.slCalc.pips.toFixed(1)} Pips
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
                                  disabled={isUploading}
                                  className="w-full py-1 bg-surfaceHighlight/50 hover:bg-surfaceHighlight text-textMuted hover:text-textMain border border-border border-dashed rounded text-[10px] flex items-center justify-center gap-1.5 transition-colors h-7 disabled:opacity-50"
                              >
                                  {isUploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                                  {isUploading ? 'Uploading...' : 'Upload'}
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
                      disabled={accounts.length === 0 || isUploading}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                          accounts.length === 0 || isUploading
                          ? 'bg-surfaceHighlight text-textMuted cursor-not-allowed opacity-50 blur-[1px]' 
                          : 'bg-primary hover:bg-blue-600 text-white'
                      }`}
                  >
                      {isUploading && <Loader2 size={16} className="animate-spin" />}
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
