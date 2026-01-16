
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
import UserModal from './components/UserModal';
import { getTrades, saveTrade, deleteTrades, getAccounts, saveAccount, deleteAccount, getTagGroups, saveTagGroups, getStrategies, saveStrategies, saveTrades, getUsers, saveUser, deleteUser, adjustAccountBalance, closeTrade } from './services/storageService';
import { Trade, TradeStats, Account, TradeType, TradeStatus, ASSETS, TagGroup, OrderType, Session, TradeOutcome, User } from './types';
import { X, Loader2, Eraser, Plus, Trash2, ArrowDown, ArrowUp } from 'lucide-react';
import { getSessionForTime } from './utils/sessionHelpers';

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
  // Daily View State
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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

  const [newTradeForm, setNewTradeForm] = useState<any>({ symbol: 'XAUUSD', screenshots: [], tags: [], setup: '', type: TradeType.LONG });
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Data Load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const loadedUsers = await getUsers();
        setUsers(loadedUsers);

        let userToSelect = loadedUsers[0]; 
        const savedUserId = localStorage.getItem('pipsuite_current_user_id');
        if (savedUserId) {
            const found = loadedUsers.find(u => u.id === savedUserId);
            if (found) userToSelect = found;
        }
        
        if (userToSelect) {
            await handleSwitchUser(userToSelect.id, loadedUsers);
        } else {
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
              id: editingUser ? editingUser.id : `user_${Date.now()}`,
              name: userData.name!,
              geminiApiKey: userData.geminiApiKey!,
              twelveDataApiKey: userData.twelveDataApiKey!
          };

          await saveUser(userToSave);
          const updatedUsers = await getUsers();
          setUsers(updatedUsers);

          if (!editingUser) {
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
              await handleSwitchUser(userToSave.id, updatedUsers);
          } else {
              if (currentUser?.id === userToSave.id) {
                  setCurrentUser(userToSave); 
              }
          }
          setIsUserModalOpen(false);
          setEditingUser(null);
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

  useEffect(() => {
    if (isAddModalOpen && selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId);
      if (acc) {
        setNewTradeForm((prev: any) => ({ ...prev, balance: acc.balance, symbol: prev.symbol || 'XAUUSD' }));
      }
    }
  }, [isAddModalOpen, selectedAccountId, accounts]);

  const filteredTrades = useMemo(() => {
    return trades.filter(t => !t.isDeleted && t.accountId === selectedAccountId);
  }, [trades, selectedAccountId]);

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
    const closedTrades = filteredTrades.filter(t => t.outcome === TradeOutcome.CLOSED);
    const totalTrades = filteredTrades.length;
    
    if (closedTrades.length === 0) {
      return { totalTrades, winRate: 0, netPnL: 0, avgWin: 0, avgLoss: 0, profitFactor: 0, bestTrade: 0, worstTrade: 0 };
    }

    const wins = closedTrades.filter(t => t.pnl > 0);
    const losses = closedTrades.filter(t => t.pnl <= 0);
    
    const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
    const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    
    const netPnL = totalWinPnl - totalLossPnl;
    const winRate = (wins.length / closedTrades.length) * 100;
    const avgWin = wins.length ? totalWinPnl / wins.length : 0;
    const avgLoss = losses.length ? totalLossPnl / losses.length : 0;
    const profitFactor = totalLossPnl === 0 ? (totalWinPnl > 0 ? 999 : 0) : totalWinPnl / totalLossPnl;
    
    const bestTrade = Math.max(...closedTrades.map(t => t.pnl), 0);
    const worstTrade = Math.min(...closedTrades.map(t => t.pnl), 0);

    return { totalTrades, winRate, netPnL, avgWin, avgLoss, profitFactor, bestTrade, worstTrade };
  }, [filteredTrades]);

  const handleSaveTrade = async (trade: Trade, shouldClose: boolean = true) => {
    try {
        const updatedTrades = await saveTrade(trade);
        if (currentUser) {
            const freshTrades = await getTrades(currentUser.id);
            setTrades(freshTrades);
        } else {
            setTrades(updatedTrades); // Fallback
        }

        if (shouldClose) {
            setSubView('list');
            setIsAddModalOpen(false);
            setIsViewModalOpen(false);
        }
    } catch (e) { alert("Failed to save trade."); }
  };

  const handleImportTrades = async (newTrades: Trade[]) => {
      try {
          await saveTrades(newTrades);
          if (currentUser) {
             const updated = await getTrades(currentUser.id);
             setTrades(updated);
          }
          alert(`Successfully imported ${newTrades.length} trades.`);
      } catch (e) { alert("Failed to import trades."); }
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
          } else {
              const tradesToTrash = trades.filter(t => tradesToDelete.includes(t.id));
              for (const t of tradesToTrash) {
                  if (t.isBalanceUpdated && t.accountId && t.pnl !== 0) {
                      await adjustAccountBalance(t.accountId, -t.pnl);
                  }
              }
              const updatedTrades = trades.map(t => {
                  if (tradesToDelete.includes(t.id)) {
                      return { ...t, isDeleted: true, deletedAt: new Date().toISOString() };
                  }
                  return t;
              });
              for (const t of updatedTrades.filter(ut => tradesToDelete.includes(ut.id))) {
                  await saveTrade(t);
              }
          }

          if (currentUser) {
             const freshTrades = await getTrades(currentUser.id);
             setTrades(freshTrades);
             const freshAccounts = await getAccounts(currentUser.id);
             setAccounts(freshAccounts);
          }

          if (selectedTradeId && tradesToDelete.includes(selectedTradeId)) {
              setIsViewModalOpen(false);
              setSubView('list');
              setSelectedTradeId(null);
          }
      } catch (e) { alert("Failed to delete trades."); } finally {
          setIsDeleteModalOpen(false);
          setTradesToDelete([]);
      }
  };

  const handleRestoreTrades = async (ids: string[]) => {
      try {
          const tradesToRestore = trades.filter(t => ids.includes(t.id));
          for (const t of tradesToRestore) {
              if (t.isBalanceUpdated && t.pnl !== 0 && t.accountId) {
                  await adjustAccountBalance(t.accountId, t.pnl);
              }
          }
          const updatedTrades = trades.map(t => {
              if (ids.includes(t.id)) return { ...t, isDeleted: false, deletedAt: undefined };
              return t;
          });
          for (const t of updatedTrades.filter(ut => ids.includes(ut.id))) await saveTrade(t);
          
          if (currentUser) {
              const freshTrades = await getTrades(currentUser.id);
              setTrades(freshTrades);
              const freshAccounts = await getAccounts(currentUser.id);
              setAccounts(freshAccounts);
          }
      } catch (e) { alert("Failed to restore trades."); }
  };

  const handleAddAccount = async (accountData: Account) => {
      if (!currentUser) return;
      const account: Account = { ...accountData, userId: currentUser.id };
      try {
        await saveAccount(account);
        const updatedAccounts = await getAccounts(currentUser.id);
        setAccounts(updatedAccounts);
        setSelectedAccountId(account.id);
        setIsAddAccountModalOpen(false);
      } catch (e) { alert("Failed to create account."); }
  };

  const handleRequestDeleteAccount = (account: Account) => { setAccountToDelete(account); };

  const handleExecuteDeleteAccount = async (fallbackAccountId: string) => {
      if (!accountToDelete || !currentUser) return;
      try {
          await deleteAccount(accountToDelete.id);
          const newAccounts = await getAccounts(currentUser.id);
          setAccounts(newAccounts);
          const newTrades = await getTrades(currentUser.id);
          setTrades(newTrades);
          
          if (fallbackAccountId && newAccounts.find(a => a.id === fallbackAccountId)) {
              setSelectedAccountId(fallbackAccountId);
          } else if (newAccounts.length > 0) {
              setSelectedAccountId(newAccounts[0].id);
          } else {
              setSelectedAccountId('');
          }
          setAccountToDelete(null);
      } catch (e) { alert("Failed to delete account"); }
  };

  const handleUpdateBalance = async (amount: number, type: 'deposit' | 'withdraw') => {
      const adjustment = type === 'deposit' ? amount : -amount;
      try {
        await adjustAccountBalance(selectedAccountId, adjustment);
        if (currentUser) {
            const updatedAccounts = await getAccounts(currentUser.id);
            setAccounts(updatedAccounts);
        }
      } catch(e) { alert("Failed to update balance."); }
  };

  const handleUpdateTags = async (newGroups: TagGroup[]) => {
      if (!currentUser) return;
      try {
          const updated = await saveTagGroups(newGroups, currentUser.id);
          setTagGroups(updated);
      } catch (e) { alert("Failed to update tags"); }
  };

  const handleCleanupTag = async (tag: string) => {
      const affectedTrades = trades.filter(t => t.tags.includes(tag));
      const updatedTrades = affectedTrades.map(t => ({
          ...t,
          tags: t.tags.filter(tg => tg !== tag)
      }));
      try {
          if (updatedTrades.length > 0) {
              await saveTrades(updatedTrades);
              if (currentUser) {
                  const fresh = await getTrades(currentUser.id);
                  setTrades(fresh);
              }
          }
      } catch (e) { alert("Failed to clean up tags from trades."); }
  };

  const handleUpdateStrategies = async (newStrategies: string[]) => {
      if (!currentUser) return;
      try {
          const updated = await saveStrategies(newStrategies, currentUser.id);
          setStrategies(updated);
      } catch (e) { alert("Failed to update strategies"); }
  };

  // -- Helpers for Modal Forms --

  const handleClearForm = () => {
      setNewTradeForm({ symbol: 'XAUUSD', screenshots: [], tags: [], setup: '', type: TradeType.LONG });
      setNewImageUrl('');
  };

  const handleLotSizeChange = (val: string) => {
      setNewTradeForm((prev: any) => ({ ...prev, quantity: val }));
  };

  const handleRiskPctChange = (val: string) => {
      setNewTradeForm((prev: any) => ({ ...prev, riskPercentage: val }));
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUser || !selectedAccountId) {
          alert("Please select an account first.");
          return;
      }
      
      try {
          if (!newTradeForm.entryPrice || !newTradeForm.quantity) {
              alert("Entry Price and Lot Size are required.");
              return;
          }

          const entryDate = new Date();
          const session = getSessionForTime(entryDate);

          const trade: Trade = {
              id: `trade_${Date.now()}`,
              accountId: selectedAccountId,
              symbol: newTradeForm.symbol || 'XAUUSD',
              type: newTradeForm.type || TradeType.LONG,
              entryPrice: parseFloat(newTradeForm.entryPrice),
              quantity: parseFloat(newTradeForm.quantity),
              entryDate: entryDate.toISOString(),
              entryTime: entryDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}),
              createdAt: entryDate.toISOString(),
              entrySession: session,
              exitSession: Session.NONE,
              status: TradeStatus.OPEN,
              outcome: TradeOutcome.OPEN,
              orderType: OrderType.MARKET,
              setup: newTradeForm.setup || '',
              notes: '',
              tags: newTradeForm.tags || [],
              screenshots: newTradeForm.screenshots || [],
              fees: 0,
              deltaFromPland: 0,
              pnl: 0,
              partials: [],
              takeProfit: newTradeForm.takeProfit ? parseFloat(newTradeForm.takeProfit) : undefined,
              stopLoss: newTradeForm.stopLoss ? parseFloat(newTradeForm.stopLoss) : undefined,
              riskPercentage: newTradeForm.riskPercentage ? parseFloat(newTradeForm.riskPercentage) : undefined,
              leverage: newTradeForm.leverage ? parseFloat(newTradeForm.leverage) : undefined,
          };

          await saveTrade(trade);
          if (currentUser) {
             const updatedTrades = await getTrades(currentUser.id);
             setTrades(updatedTrades);
          }
          
          setIsAddModalOpen(false);
          handleClearForm();
      } catch (error) {
          console.error(error);
          alert("Failed to add trade");
      }
  };

  const navigateToTrade = (trade: Trade) => {
      setSelectedTradeId(trade.id);
      setIsViewModalOpen(true);
      setSelectedDailyDate(null);
  };

  const handleEditFromModal = () => {
      setIsViewModalOpen(false);
      setSubView('detail');
  };

  const renderContent = () => {
      if (subView === 'detail' && selectedTradeId) {
          const trade = trades.find(t => t.id === selectedTradeId);
          if (trade) {
              return (
                  <TradeDetail 
                      trade={trade}
                      accounts={accounts}
                      tagGroups={tagGroups}
                      strategies={strategies}
                      onSave={(t, close) => handleSaveTrade(t, close)}
                      onDelete={(id) => handleRequestDelete([id])}
                      onBack={() => {
                          setSubView('list');
                          setSelectedTradeId(null);
                      }}
                      onUpdateBalance={handleUpdateBalance}
                  />
              );
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
                      onDayClick={(date, dayTrades) => {
                          setSelectedDailyDate(date);
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
                  <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
                      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                          <h2 className="text-lg font-bold mb-4">Account Settings</h2>
                          <div className="space-y-3">
                              {accounts.map(acc => (
                                  <div key={acc.id} className="flex justify-between items-center p-3 bg-surfaceHighlight rounded-lg border border-border/50">
                                      <div>
                                          <div className="font-bold text-sm text-textMain">{acc.name}</div>
                                          <div className="text-xs text-textMuted">{acc.currency} • {acc.type} • ${acc.balance.toLocaleString()}</div>
                                      </div>
                                      <button onClick={() => handleRequestDeleteAccount(acc)} className="text-loss hover:bg-loss/10 p-2 rounded transition-colors">
                                          <Trash2 size={16} />
                                      </button>
                                  </div>
                              ))}
                          </div>
                          <button onClick={() => setIsAddAccountModalOpen(true)} className="mt-4 text-sm text-primary font-medium hover:underline flex items-center gap-1">
                              <Plus size={14} /> Add New Account
                          </button>
                      </div>

                      <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                          <h2 className="text-lg font-bold mb-4">User Profile</h2>
                          <div className="flex items-center justify-between p-3 bg-surfaceHighlight rounded-lg border border-border/50">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-primary/20 text-primary rounded-full flex items-center justify-center font-bold">
                                      {currentUser?.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                      <div className="font-bold text-sm text-textMain">{currentUser?.name}</div>
                                      <div className="text-xs text-textMuted">ID: {currentUser?.id.substring(0, 10)}...</div>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button 
                                      onClick={() => {
                                          setEditingUser(currentUser);
                                          setIsUserModalOpen(true);
                                      }} 
                                      className="text-xs bg-surface border border-border px-3 py-1.5 rounded hover:bg-surfaceHighlight text-textMain transition-colors"
                                  >
                                      Edit Profile
                                  </button>
                                  <button 
                                      onClick={() => currentUser && handleUserDelete(currentUser.id)}
                                      className="text-xs text-loss hover:bg-loss/10 px-3 py-1.5 rounded transition-colors"
                                  >
                                      Delete User
                                  </button>
                              </div>
                          </div>
                          <button 
                              onClick={() => {
                                  setEditingUser(null);
                                  setIsUserModalOpen(true);
                              }}
                              className="mt-4 text-sm text-primary font-medium hover:underline flex items-center gap-1"
                          >
                              <Plus size={14} /> Create New User Profile
                          </button>
                      </div>

                      <TagManager 
                          groups={tagGroups} 
                          onUpdate={handleUpdateTags} 
                          onCleanupTag={handleCleanupTag}
                      />
                      <StrategyManager 
                          strategies={strategies}
                          onUpdate={handleUpdateStrategies}
                      />
                  </div>
              );
          default:
              return <div>Tab not found</div>;
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
      onUpdateBalance={handleUpdateBalance}
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

      {isAddModalOpen && (
        <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsAddModalOpen(false)}
        >
          <div 
            className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
             <div className="p-5 border-b border-border flex justify-between items-center shrink-0">
              <h3 className="text-lg font-bold text-textMain">Add Trade</h3>
              <div className="flex items-center gap-3">
                 <button onClick={() => setIsAddModalOpen(false)} className="text-textMuted hover:text-textMain"><X size={20} /></button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <form id="add-trade-form" onSubmit={handleQuickAdd} className="p-5 pt-4 space-y-4">
                  
                  {/* Direction Switcher */}
                  <div className="flex bg-surfaceHighlight p-1 rounded-lg">
                      <button
                          type="button"
                          onClick={() => setNewTradeForm({...newTradeForm, type: TradeType.LONG})}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${
                              newTradeForm.type === TradeType.LONG 
                              ? 'bg-background shadow text-profit' 
                              : 'text-textMuted hover:text-textMain'
                          }`}
                      >
                          <ArrowUp size={14} /> LONG
                      </button>
                      <button
                          type="button"
                          onClick={() => setNewTradeForm({...newTradeForm, type: TradeType.SHORT})}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center gap-1 transition-all ${
                              newTradeForm.type === TradeType.SHORT 
                              ? 'bg-background shadow text-loss' 
                              : 'text-textMuted hover:text-textMain'
                          }`}
                      >
                          <ArrowDown size={14} /> SHORT
                      </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-textMuted mb-1">Asset Pair</label>
                      <select name="symbol" onChange={(e) => setNewTradeForm({...newTradeForm, symbol: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain uppercase focus:outline-none focus:border-primary" required value={newTradeForm.symbol || 'XAUUSD'}>
                          {ASSETS.map(asset => (<option key={asset.id} value={asset.assetPair}>{asset.assetPair}</option>))}
                      </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-textMuted mb-1">Setup / Strategy</label>
                        <select 
                            value={newTradeForm.setup || ''} 
                            onChange={(e) => setNewTradeForm({...newTradeForm, setup: e.target.value})}
                            className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:outline-none focus:border-primary"
                        >
                            <option value="">Select Strategy</option>
                            {strategies.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div><label className="block text-xs font-medium text-textMuted mb-1">Entry Price</label><input type="number" step="any" value={newTradeForm.entryPrice || ''} onChange={(e) => setNewTradeForm({...newTradeForm, entryPrice: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:outline-none focus:border-primary" required placeholder="0.00" /></div>
                    <div><label className="block text-xs font-medium text-textMuted mb-1">Leverage</label><input type="number" step="any" value={newTradeForm.leverage || ''} onChange={(e) => setNewTradeForm({...newTradeForm, leverage: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:outline-none focus:border-primary" placeholder="1:100" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-textMuted mb-1">Take Profit</label><input type="number" step="any" value={newTradeForm.takeProfit || ''} onChange={(e) => setNewTradeForm({...newTradeForm, takeProfit: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:outline-none focus:border-primary" placeholder="Optional" /></div>
                    <div><label className="block text-xs font-medium text-textMuted mb-1">Stop Loss</label><input type="number" step="any" value={newTradeForm.stopLoss || ''} onChange={(e) => setNewTradeForm({...newTradeForm, stopLoss: e.target.value})} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:outline-none focus:border-primary" placeholder="Optional" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-medium text-textMuted mb-1">Lot Size</label><input type="number" step="any" value={newTradeForm.quantity || ''} onChange={(e) => handleLotSizeChange(e.target.value)} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:outline-none focus:border-primary" required placeholder="1.0" /></div>
                    <div><label className="block text-xs font-medium text-textMuted mb-1">Risk %</label><input type="number" step="any" value={newTradeForm.riskPercentage || ''} onChange={(e) => handleRiskPctChange(e.target.value)} className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:outline-none focus:border-primary" placeholder="1%" /></div>
                  </div>
              </form>
            </div>
            <div className="p-4 border-t border-border flex gap-3 shrink-0 bg-surface rounded-b-xl">
                  <button type="button" onClick={handleClearForm} className="px-4 py-2 bg-surface border border-border rounded-lg text-textMuted text-sm hover:text-textMain transition-colors"><Eraser size={16} /></button>
                  <button type="submit" form="add-trade-form" disabled={accounts.length === 0} className="flex-1 bg-primary hover:bg-blue-600 text-white py-2 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5">Save Trade</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
