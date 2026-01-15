
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
import { getTrades, saveTrade, deleteTrades, getAccounts, saveAccount, deleteAccount, getTagGroups, saveTagGroups, getStrategies, saveStrategies, saveTrades, getSetting, saveSetting, getUsers, saveUser, deleteUser } from './services/storageService';
import { fetchCurrentPrice, PriceResult } from './services/priceService';
import { extractTradeParamsFromImage } from './services/geminiService';
import { Trade, TradeStats, Account, TradeType, TradeStatus, ASSETS, TagGroup, OrderType, Session, TradeOutcome, User } from './types';
import { X, ChevronDown, Calculator, TrendingUp, TrendingDown, RefreshCw, Loader2, Upload, Plus, Trash2, Clipboard, ChevronUp, Eraser, Check, User as UserIcon } from 'lucide-react';
import UserModal from './components/UserModal';

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

  // Filter State - Default to Current Month
  const [startDate, setStartDate] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState(() => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

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
  const [editingUser, setEditingUser] = useState<User | null>(null); // For UserModal

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [tradesToDelete, setTradesToDelete] = useState<string[]>([]);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
      const savedTheme = localStorage.getItem('pipsuite_theme');
      return savedTheme ? savedTheme === 'dark' : true; 
  });
  
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

  // Initial Load
  useEffect(() => {
    const initApp = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Users
            const loadedUsers = await getUsers();
            setUsers(loadedUsers);

            // 2. Determine Current User
            let userToSelect = loadedUsers[0]; // Default fallback
            const savedUserId = localStorage.getItem('pipsuite_current_user_id');
            if (savedUserId) {
                const found = loadedUsers.find(u => u.id === savedUserId);
                if (found) userToSelect = found;
            }
            
            if (userToSelect) {
                await handleSwitchUser(userToSelect.id, loadedUsers);
            }

            // 3. Global Settings
            const [datePref, activeTabPref] = await Promise.all([
                getSetting<{start: string, end: string} | null>('pipsuite_date_range', null),
                getSetting<string>('pipsuite_active_tab', 'dashboard')
            ]);

            if (datePref) {
                setStartDate(datePref.start);
                setEndDate(datePref.end);
            }
            if (activeTabPref) {
                setActiveTab(activeTabPref);
            }

        } catch (e) {
            console.error("Initialization Failed", e);
        } finally {
            setIsLoading(false);
        }
    };
    initApp();
  }, []);

  // Handler to switch user and reload scoped data
  const handleSwitchUser = async (userId: string, userList = users) => {
      const newUser = userList.find(u => u.id === userId);
      if (!newUser) return;

      setCurrentUser(newUser);
      localStorage.setItem('pipsuite_current_user_id', newUser.id);

      // Load User Scoped Data
      const [userAccounts, userTrades, userTags, userStrategies] = await Promise.all([
          getAccounts(userId),
          getTrades(), 
          getTagGroups(userId),
          getStrategies(userId)
      ]);

      setAccounts(userAccounts);
      // Determine selected account
      if (userAccounts.length > 0) {
          // Check if previously selected account belongs to this user
          const savedAccountId = localStorage.getItem(`pipsuite_selected_account_${userId}`);
          if (savedAccountId && userAccounts.some(a => a.id === savedAccountId)) {
              setSelectedAccountId(savedAccountId);
          } else {
              setSelectedAccountId(userAccounts[0].id);
          }
      } else {
          setSelectedAccountId('');
      }

      setTrades(userTrades);
      setTagGroups(userTags);
      setStrategies(userStrategies);
  };

  // Persist selected account for current user
  const handleAccountChange = (id: string) => {
      setSelectedAccountId(id);
      if (currentUser) {
          localStorage.setItem(`pipsuite_selected_account_${currentUser.id}`, id);
      }
  };

  // Handle User Creation/Edit
  const handleUserSave = async (userData: Partial<User>) => {
      try {
          const userToSave: User = {
              id: editingUser ? editingUser.id : `user_${Date.now()}`,
              name: userData.name!,
              geminiApiKey: userData.geminiApiKey!,
              twelveDataApiKey: userData.twelveDataApiKey!
          };

          const savedUser = await saveUser(userToSave);
          
          // Refresh user list
          const updatedUsers = await getUsers();
          setUsers(updatedUsers);

          if (!editingUser) {
              // If new user, create default account
              const defaultAccount: Account = {
                  id: `acc_${Date.now()}_first`,
                  userId: userToSave.id,
                  name: "First Account",
                  currency: 'USD',
                  balance: 0,
                  isDemo: false,
                  type: 'Real'
              };
              await saveAccount(defaultAccount);
              
              // Switch to new user
              await handleSwitchUser(userToSave.id, updatedUsers);
          } else {
              // Update current user state if we edited the current user
              if (currentUser?.id === userToSave.id) {
                  setCurrentUser(userToSave); // Update keys in state
              }
          }
      } catch (e) {
          alert("Failed to save user.");
      }
  };

  const handleUserDelete = async (userId: string) => {
      if (users.length <= 1) {
          alert("You cannot delete the last user. The application requires at least one user.");
          return;
      }
      
      if (!window.confirm("Are you sure? This will delete the user and ALL associated accounts and trades.")) return;

      try {
          await deleteUser(userId);
          const updatedUsers = await getUsers();
          setUsers(updatedUsers);
          
          if (currentUser?.id === userId) {
              // Switch to the first available user
              await handleSwitchUser(updatedUsers[0].id, updatedUsers);
          }
      } catch (e) {
          alert("Failed to delete user.");
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
    const handlePaste = (e: ClipboardEvent) => {
      if (!isAddModalOpen) return; 

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

  // Trades Filtering
  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      if (t.isDeleted) return false;

      // Ensure trade belongs to an account owned by current user
      const account = accounts.find(a => a.id === t.accountId);
      if (!account || account.userId !== currentUser?.id) return false;

      const tDate = new Date(t.entryDate || t.createdAt);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const dateMatch = tDate >= start && tDate <= end;
      const accountMatch = t.accountId === selectedAccountId;
      
      return dateMatch && accountMatch;
    });
  }, [trades, startDate, endDate, selectedAccountId, currentUser, accounts]);

  const trashTrades = useMemo(() => {
      return trades.filter(t => {
          const account = accounts.find(a => a.id === t.accountId);
          return t.isDeleted && account?.userId === currentUser?.id && t.accountId === selectedAccountId;
      });
  }, [trades, selectedAccountId, currentUser, accounts]);

  const selectedDailyTrades = useMemo(() => {
      if (!selectedDailyDate) return [];
      return trades.filter(t => {
          if (t.isDeleted) return false;
          const account = accounts.find(a => a.id === t.accountId);
          if (!account || account.userId !== currentUser?.id) return false;

          const tDate = new Date(t.entryDate || t.createdAt).toLocaleDateString('en-CA');
          return tDate === selectedDailyDate && t.accountId === selectedAccountId;
      });
  }, [trades, selectedDailyDate, selectedAccountId, currentUser, accounts]);


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
        setTrades(updatedTrades); // Updates global trade list, filters handle visibility
        
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
          
          if (newTrades.length > 0) {
              // ... date range logic ...
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
              // Soft Delete logic
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
      // ... restore logic ...
      // Same logic as before but uses saveTrade which updates DB
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
      if (!currentUser) return;
      const account: Account = { ...accountData, userId: currentUser.id };
      try {
        const updatedAccounts = await saveAccount(account);
        setAccounts(updatedAccounts);
        handleAccountChange(account.id);
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
          // Trades removed automatically via cascade in DB, but update local state
          setTrades(prev => prev.filter(t => t.accountId !== accountToDelete.id));
          
          if (fallbackAccountId && newAccounts.find(a => a.id === fallbackAccountId)) {
              handleAccountChange(fallbackAccountId);
          } else if (newAccounts.length > 0) {
              handleAccountChange(newAccounts[0].id);
          } else {
              handleAccountChange('');
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
            setAccounts(updatedAccounts); // Backend returns filtered list for user
          } catch(e) {
            alert("Failed to update balance.");
          }
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

  const handleUpdateStrategies = async (newStrategies: string[]) => {
      if (!currentUser) return;
      try {
          const updated = await saveStrategies(newStrategies, currentUser.id);
          setStrategies(updated);
      } catch (e) {
          alert("Failed to update strategies");
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Image too large (Max 2MB)");
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewTradeForm((prev: any) => ({
            ...prev,
            screenshots: [...(prev.screenshots || []), reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

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

  const handleLotSizeChange = (val: string) => {
    setNewTradeForm((prev: any) => ({ ...prev, quantity: val }));
  };
  const handleRiskPctChange = (val: string) => {
    setNewTradeForm((prev: any) => ({ ...prev, riskPercentage: val }));
  };
  const handleClearForm = () => {
      setNewTradeForm({ symbol: 'XAUUSD', screenshots: [], tags: [], setup: '' });
      setNewImageUrl('');
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
      const entryPrice = parseFloat(newTradeForm.entryPrice);
      
      const newTrade: Trade = {
          id: Date.now().toString(),
          accountId: selectedAccountId,
          symbol: (newTradeForm.symbol || 'XAUUSD').toUpperCase(),
          type: TradeType.LONG, // Default to Long if missing
          entryDate: new Date().toISOString(),
          entryPrice: entryPrice,
          quantity: parseFloat(newTradeForm.quantity),
          fees: 0,
          pnl: 0,
          status: TradeStatus.OPEN,
          outcome: TradeOutcome.OPEN,
          screenshots: newTradeForm.screenshots || [],
          tags: newTradeForm.tags || [],
          isDeleted: false,
          setup: newTradeForm.setup || '',
          notes: newTradeForm.notes || ''
      };

      handleSaveTrade(newTrade);
      handleClearForm();
  };
  
  const toggleTheme = () => {
      const newTheme = !isDarkMode ? 'dark' : 'light';
      setIsDarkMode(!isDarkMode);
      localStorage.setItem('pipsuite_theme', newTheme);
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
          <div className="p-8 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Settings</h2>
            </div>
            
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
                                       <div className="flex gap-3 text-[10px] text-textMuted mt-0.5">
                                           <span>Gemini: {u.geminiApiKey ? '••••' : 'Missing'}</span>
                                           <span>12Data: {u.twelveDataApiKey ? '••••' : 'Missing'}</span>
                                       </div>
                                   </div>
                               </div>
                               
                               <div className="flex items-center gap-2">
                                   {!isCurrent && (
                                       <button 
                                            onClick={() => handleSwitchUser(u.id, users)}
                                            className="p-1.5 text-textMuted hover:text-primary hover:bg-primary/10 rounded transition-colors text-xs font-medium"
                                       >
                                           Select
                                       </button>
                                   )}
                                   <button 
                                        onClick={() => { setEditingUser(u); setIsUserModalOpen(true); }}
                                        className="p-1.5 text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded transition-colors"
                                        title="Edit User"
                                   >
                                       <Eraser size={14} />
                                   </button>
                                   {!isCurrent && (
                                       <button 
                                            onClick={() => handleUserDelete(u.id)}
                                            className="p-1.5 text-textMuted hover:text-loss hover:bg-loss/10 rounded transition-colors"
                                            title="Delete User"
                                       >
                                           <Trash2 size={14} />
                                       </button>
                                   )}
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
            
            <TagManager groups={tagGroups} onUpdate={handleUpdateTags} />
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
                  <p className="text-textMuted font-medium">Loading...</p>
              </div>
          </div>
      )
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={handleTabChange}
      accounts={accounts} 
      selectedAccountId={selectedAccountId}
      setSelectedAccountId={handleAccountChange}
      onAddTradeClick={() => setIsAddModalOpen(true)}
      startDate={startDate}
      setStartDate={(d) => handleDateRangeChange(d, endDate)}
      endDate={endDate}
      setEndDate={(d) => handleDateRangeChange(startDate, d)}
      toggleTheme={toggleTheme}
      isDarkMode={isDarkMode}
      onUpdateBalance={handleUpdateBalance}
      users={users}
      currentUser={currentUser}
      onSwitchUser={(id) => handleSwitchUser(id, users)}
      onCreateUser={() => { setEditingUser(null); setIsUserModalOpen(true); }}
      onDeleteUser={handleUserDelete}
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
      />

      {accountToDelete && (
          <DeleteAccountModal 
              accountToDelete={accountToDelete}
              otherAccounts={accounts.filter(a => a.id !== accountToDelete.id)}
              onClose={() => setAccountToDelete(null)}
              onConfirm={handleExecuteDeleteAccount}
          />
      )}

      {/* Add Trade Modal (Simplified for view) */}
      {isAddModalOpen && (
        <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
             {/* ... Modal content similar to previous App.tsx ... */}
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
                  {/* ... Form fields (Asset, Price, Entry, SL, TP, etc) ... */}
                  {/* ... Including Screenshot section, Notes & Tags ... */}
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
                        <label className="block text-xs font-medium mb-1">Lot Size</label>
                        <input 
                          type="number" 
                          step="any" 
                          value={newTradeForm.quantity || ''}
                          onChange={(e) => handleLotSizeChange(e.target.value)} 
                          className="w-full bg-background border border-border rounded p-2 text-sm text-textMain"
                          required 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium mb-1">Risk %</label>
                        <input 
                          type="number" 
                          step="any" 
                          value={newTradeForm.riskPercentage || ''}
                          onChange={(e) => handleRiskPctChange(e.target.value)} 
                          className="w-full bg-background border border-border rounded p-2 text-sm text-textMain"
                        />
                    </div>
                  </div>
                  
                  {/* Screenshots & Notes Section reused */}
                  <div className="bg-surface border border-border rounded-lg p-2 mt-2">
                      <h4 className="text-[10px] font-bold mb-1.5 flex justify-between items-center text-textMuted uppercase tracking-wider">
                          Screenshots <span className="text-[9px] bg-surfaceHighlight px-1.5 py-0.5 rounded text-textMuted">Ctrl+V</span>
                      </h4>
                      <div className="space-y-1.5">
                        {newTradeForm.screenshots && newTradeForm.screenshots.length > 0 && (
                            <div className="grid grid-cols-5 gap-1.5 mb-2">
                              {newTradeForm.screenshots.map((url: string, idx: number) => (
                                <div key={idx} className="relative group rounded overflow-hidden border border-border h-10 w-full bg-background">
                                  <img src={url} alt={`Screenshot ${idx}`} className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                        )}
                        <div className="flex gap-1.5">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 py-1 bg-surfaceHighlight/50 hover:bg-surfaceHighlight text-textMuted hover:text-textMain border border-border border-dashed rounded text-[10px] flex items-center justify-center gap-1.5 transition-colors h-7"
                            >
                                <Upload size={10} /> Upload
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                        </div>
                      </div>
                  </div>

                  <div className="mt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsNotesOpen(!isNotesOpen)}
                      className="flex items-center justify-between w-full py-2 text-xs font-medium text-textMuted hover:text-textMain border-b border-border transition-colors"
                    >
                      <span className="flex items-center gap-2">Notes & Tags</span>
                      {isNotesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {isNotesOpen && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-textMuted mb-1">Technical Notes</label>
                          <textarea 
                            value={newTradeForm.notes || ''} 
                            onChange={(e) => setNewTradeForm({...newTradeForm, notes: e.target.value})} 
                            className="w-full bg-background border border-border rounded p-2 text-sm text-textMain min-h-[60px]" 
                          />
                        </div>
                        
                        <div className="border-t border-border pt-3">
                          <label className="block text-xs font-medium text-textMuted mb-2">Tags</label>
                          <div className="flex flex-wrap gap-1.5 p-2 bg-surfaceHighlight/30 rounded-lg border border-border/50 min-h-[36px]">
                              {newTradeForm.tags.map((tag: string) => (
                                  <span key={tag} className="flex items-center gap-1 pl-2 pr-1 py-0.5 bg-primary/10 text-primary text-[10px] font-medium rounded border border-primary/20">
                                      {tag}
                                      <button type="button" onClick={() => toggleTag(tag)}><X size={10} /></button>
                                  </span>
                              ))}
                          </div>
                          <div className="mt-2 space-y-2">
                              {tagGroups.map(group => (
                                  <div key={group.name} className="flex flex-wrap gap-1">
                                      {group.tags.map(tag => (
                                          <button
                                            key={tag}
                                            type="button"
                                            onClick={() => toggleTag(tag)}
                                            className={`px-1.5 py-0.5 text-[9px] border rounded ${newTradeForm.tags.includes(tag) ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-border text-textMuted'}`}
                                          >
                                              {tag}
                                          </button>
                                      ))}
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
