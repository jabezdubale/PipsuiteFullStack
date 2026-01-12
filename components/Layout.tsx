
import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Calendar,
  Settings, 
  Menu, 
  X, 
  Sun,
  Moon,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CandlestickChart,
  Wallet,
  Trash2
} from 'lucide-react';
import { Account } from '../types';
import BalanceAdjustmentModal from './BalanceAdjustmentModal';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accounts: Account[];
  selectedAccountId: string;
  setSelectedAccountId: (id: string) => void;
  onAddTradeClick: () => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  onUpdateBalance: (amount: number, type: 'deposit' | 'withdraw') => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  accounts, 
  selectedAccountId, 
  setSelectedAccountId,
  onAddTradeClick,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  toggleTheme,
  isDarkMode,
  onUpdateBalance
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'journal', label: 'Trades', icon: BookOpen },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-background text-textMain overflow-hidden font-sans transition-colors duration-200">
      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden md:flex flex-col border-r border-border bg-surface transition-all duration-300 relative ${
          isSidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Collapse/Expand Toggle - Absolute Positioned */}
        <button 
           onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
           className="absolute -right-3 top-6 z-10 bg-surface border border-border rounded-full p-1 text-textMuted hover:text-primary transition-colors shadow-sm"
           title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
           {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className={`h-16 flex items-center border-b border-border ${isSidebarCollapsed ? 'justify-center' : 'px-4'}`}>
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
               <CandlestickChart className="text-white" size={20} />
            </div>
            {!isSidebarCollapsed && <h1 className="text-lg font-bold tracking-tight truncate">PipSuite</h1>}
          </div>
        </div>
        
        <div className="p-3">
           {isSidebarCollapsed ? (
             <button 
                onClick={onAddTradeClick} 
                className="w-full h-10 bg-primary hover:bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg transition-all"
                title="Add Trade"
             >
                <Plus size={20} />
             </button>
           ) : (
             <button 
                onClick={onAddTradeClick}
                className="w-full bg-primary hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
             >
                <Plus size={16} /> Add Trade
             </button>
           )}
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === item.id 
                  ? 'bg-surfaceHighlight text-primary' 
                  : 'text-textMuted hover:bg-surfaceHighlight hover:text-textMain'
              } ${isSidebarCollapsed ? 'justify-center' : ''}`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon size={18} />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        
        <div className="p-3 border-t border-border">
          <button 
              onClick={toggleTheme}
              className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'} text-textMuted hover:text-textMain text-xs w-full px-2 py-1.5 transition-all`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              {!isSidebarCollapsed && <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header (Mobile & Desktop Filters) */}
        <header className="h-14 border-b border-border bg-surface flex items-center justify-between px-4 md:px-6 z-20 shrink-0">
          
          {/* Left: Mobile Logo & Desktop Account Select */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 md:hidden">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <CandlestickChart className="text-white" size={20} />
                </div>
                <span className="font-bold">PipSuite</span>
            </div>

            {/* Desktop Account Selector */}
            <div className="hidden md:block relative">
                 <select 
                    value={selectedAccountId} 
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="appearance-none bg-surfaceHighlight border border-border rounded-md pl-3 pr-8 py-1.5 text-xs font-medium text-textMain focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer hover:border-primary/50 transition-colors"
                 >
                   {accounts.length > 0 ? (
                      accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))
                   ) : (
                      <option value="">No Accounts</option>
                   )}
                 </select>
                 <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none" size={12} />
             </div>
          </div>

          {/* Center: Date Filters (Desktop) */}
          <div className="hidden md:flex items-center gap-2 bg-surfaceHighlight/30 p-1 rounded-lg border border-border/50">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-xs text-textMain focus:ring-0 cursor-pointer font-medium p-1"
                title="Start Date"
              />
              <span className="text-textMuted text-xs">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-xs text-textMain focus:ring-0 cursor-pointer font-medium p-1"
                title="End Date"
              />
          </div>

          {/* Right: Balance & Mobile Menu */}
          <div className="flex items-center gap-4">
             {/* Desktop Balance Display */}
             {selectedAccount && (
                 <div className="hidden md:flex items-center gap-3 pl-4 border-l border-border h-8">
                     <span className="text-lg font-bold text-textMain font-mono tracking-tight">
                         ${selectedAccount.balance.toLocaleString()}
                     </span>
                     <button 
                        onClick={() => setIsBalanceModalOpen(true)}
                        className="p-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                        title="Deposit / Withdraw"
                     >
                         <Wallet size={16} />
                     </button>
                 </div>
             )}

             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-textMuted hover:text-textMain">
               {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
             </button>
          </div>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute inset-0 top-14 bg-background z-50 p-4 md:hidden flex flex-col gap-4" onClick={() => setIsMobileMenuOpen(false)}>
             <div className="flex flex-col gap-4 bg-surface p-4 rounded-xl shadow-2xl border border-border" onClick={(e) => e.stopPropagation()}>
                
                <button 
                    onClick={() => { onAddTradeClick(); setIsMobileMenuOpen(false); }}
                    className="w-full bg-primary text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                    <Plus size={18} /> Add Trade
                </button>

                {/* Mobile Account Selector */}
                <div>
                <label className="text-xs text-textMuted mb-1 block">Account</label>
                <select 
                    value={selectedAccountId} 
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-surfaceHighlight border border-border rounded-lg p-2 text-textMain text-sm"
                >
                    {accounts.length > 0 ? (
                        accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} - ${acc.balance.toLocaleString()}</option>
                        ))
                    ) : (
                        <option value="">No Accounts</option>
                    )}
                </select>
                </div>

                {/* Mobile Date Filters */}
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="text-xs text-textMuted mb-1 block">From</label>
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-surfaceHighlight border border-border rounded-lg p-2 text-textMain text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs text-textMuted mb-1 block">To</label>
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-surfaceHighlight border border-border rounded-lg p-2 text-textMain text-sm"
                        />
                    </div>
                </div>
                
                {/* Mobile Balance Action */}
                <div className="flex justify-between items-center bg-surfaceHighlight p-3 rounded-lg">
                    <span className="font-bold">${selectedAccount?.balance.toLocaleString() || '0'}</span>
                    <button 
                        onClick={() => { setIsBalanceModalOpen(true); setIsMobileMenuOpen(false); }}
                        className="text-xs bg-primary text-white px-3 py-1.5 rounded"
                    >
                        Manage Funds
                    </button>
                </div>

                <nav className="space-y-1 mt-2">
                {navItems.map((item) => (
                    <button
                    key={item.id}
                    onClick={() => {
                        setActiveTab(item.id);
                        setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === item.id 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-textMuted hover:bg-surfaceHighlight'
                    }`}
                    >
                    <item.icon size={18} />
                    {item.label}
                    </button>
                ))}
                </nav>
                <div className="mt-auto border-t border-border pt-4">
                    <button onClick={toggleTheme} className="flex items-center gap-2 text-textMuted text-sm">
                        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />} Switch Theme
                    </button>
                </div>
             </div>
          </div>
        )}

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {isBalanceModalOpen && selectedAccount && (
          <BalanceAdjustmentModal 
            currentBalance={selectedAccount.balance}
            onClose={() => setIsBalanceModalOpen(false)}
            onConfirm={onUpdateBalance}
          />
      )}
    </div>
  );
};

export default Layout;
