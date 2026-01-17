
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine
} from 'recharts';
import { Trade, TradeStats, TagGroup, TradeOutcome, TradeStatus, ASSETS } from '../types';
import { 
  TrendingUp, 
  Target, 
  Activity, 
  Settings, 
  BarChart2, 
  X, 
  Zap, 
  Clock, 
  Calendar as CalendarIcon, 
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  DollarSign,
  Hourglass,
  ListFilter,
  Check,
  GripHorizontal,
  Timer,
  Loader2
} from 'lucide-react';
import { getSetting, saveSetting } from '../services/storageService';
import { getCalendarDateKey } from '../utils/dateUtils';

interface DashboardProps {
  stats: TradeStats; 
  trades: Trade[];
  tagGroups: TagGroup[];
}

interface MatrixStats {
    count: number;
    wins: number;
    pnl: number;
}

// --- Helper Components ---

const InfoTooltip = ({ title, content }: { title: string, content: React.ReactNode }) => {
  const [isBottom, setIsBottom] = useState(false);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setIsBottom(rect.top < 220);
  };

  return (
    <div className="group relative ml-1.5 inline-flex items-center justify-center z-50" onMouseEnter={handleMouseEnter}>
      <Info size={14} className="text-textMuted/50 cursor-help hover:text-primary transition-colors" />
      <div 
        className={`absolute left-1/2 -translate-x-1/2 w-72 sm:w-80 p-4 bg-surface border border-border shadow-2xl rounded-xl text-xs text-textMain opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none leading-relaxed z-[60] ${
            isBottom ? 'top-full mt-3' : 'bottom-full mb-3'
        }`}
      >
          <h4 className="font-bold text-primary mb-1 text-sm">{title}</h4>
          <div className="space-y-2 text-textMuted">{content}</div>
          <div 
            className={`absolute left-1/2 -translate-x-1/2 border-8 border-transparent ${
                isBottom ? 'bottom-full border-b-border' : 'top-full border-t-border'
            }`}
          ></div>
      </div>
    </div>
  );
};

const MultiSelectDropdown = ({ options, selected, onChange, label }: { options: string[], selected: string[], onChange: (selected: string[]) => void, label: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(s => s !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`p-1.5 rounded transition-colors flex items-center gap-1.5 ${isOpen || selected.length > 0 ? 'bg-primary/10 text-primary border border-primary/20' : 'text-textMuted hover:text-textMain hover:bg-surfaceHighlight'}`}
                title={`Filter ${label}`}
            >
                <ListFilter size={14} />
                {selected.length > 0 && <span className="text-[10px] font-bold">{selected.length}</span>}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 max-h-60 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                    <div className="p-2 border-b border-border text-[10px] font-bold text-textMuted uppercase tracking-wider bg-surfaceHighlight/30 flex justify-between items-center">
                        Select {label}
                        {selected.length > 0 && (
                            <button onClick={() => onChange([])} className="text-primary hover:underline">Clear</button>
                        )}
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                        {options.map(opt => (
                            <button
                                key={opt}
                                onClick={() => toggleOption(opt)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-textMain hover:bg-surfaceHighlight rounded text-left"
                            >
                                <div className={`w-3 h-3 rounded border flex items-center justify-center ${selected.includes(opt) ? 'bg-primary border-primary' : 'border-textMuted'}`}>
                                    {selected.includes(opt) && <Check size={8} className="text-white" />}
                                </div>
                                <span className="truncate">{opt}</span>
                            </button>
                        ))}
                        {options.length === 0 && <div className="p-2 text-xs text-textMuted text-center">No options available</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

const VitalCard = ({ label, value, subValue, trend, icon: Icon, colorClass, isFaded = false }: any) => (
  <div className={`bg-surface border border-border rounded-xl p-4 flex flex-col justify-between hover:border-primary/30 transition-all shadow-sm relative overflow-hidden group h-[110px] ${isFaded ? 'opacity-50 grayscale-[0.5]' : ''}`}>
    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={48} />
    </div>
    <div>
        <p className="text-[10px] uppercase tracking-wider text-textMuted font-bold flex items-center gap-1.5 mb-1">
            <Icon size={12} /> {label}
        </p>
        <h3 className={`text-2xl font-bold ${colorClass}`}>{value}</h3>
    </div>
    {subValue && (
        <div className="mt-2 text-xs font-medium text-textMuted flex items-center gap-1">
            {trend === 'up' && <ArrowUpRight size={12} className="text-profit" />}
            {trend === 'down' && <ArrowDownRight size={12} className="text-loss" />}
            {subValue}
        </div>
    )}
  </div>
);

const WidgetContainer = ({ title, icon: Icon, children, className = '', tooltipTitle, tooltipContent, controls, onDragHandleMouseDown }: any) => (
  <div className={`bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col h-[360px] ${className} group/widget transition-transform duration-200 ease-in-out`}>
    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50 shrink-0 h-[40px]">
        <div className="flex items-center gap-2">
            <div 
                className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-textMuted/30 hover:text-textMuted opacity-0 group-hover/widget:opacity-100 transition-opacity"
                onMouseDown={onDragHandleMouseDown}
            >
                <GripHorizontal size={14} />
            </div>
            <Icon size={16} className="text-primary" />
            <h3 className="font-bold text-sm text-textMain uppercase tracking-wide flex items-center">
                {title}
                {tooltipContent && <InfoTooltip title={tooltipTitle} content={tooltipContent} />}
            </h3>
        </div>
        {controls && <div>{controls}</div>}
    </div>
    <div className="flex-1 w-full min-h-0 relative overflow-hidden">
        {children}
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ stats: initialStats, trades, tagGroups }) => {
  const [activeTagFilter, setActiveTagFilter] = useState<string[]>([]);
  const [activeAssetFilter, setActiveAssetFilter] = useState<string[]>([]); 
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [visibleSetups, setVisibleSetups] = useState<string[]>([]);
  const [visibleAssetPairs, setVisibleAssetPairs] = useState<string[]>([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [hourlyFormat12, setHourlyFormat12] = useState(true);
  
  const [visibleWidgets, setVisibleWidgets] = useState({
      assetMatrix: true, tags: true, heatmap: true, hourly: true, daily: true, expectancy: true, patience: true, holdTimeDistribution: true, holdTime: true,
  });

  const [widgetOrder, setWidgetOrder] = useState([
      'assetMatrix', 'tags', 'heatmap', 'hourly', 'daily', 'expectancy', 'patience', 'holdTimeDistribution', 'holdTime'
  ]);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const loadSettings = async () => {
        const savedOrder = await getSetting('pipsuite_dashboard_order', [
            'assetMatrix', 'tags', 'heatmap', 'hourly', 'daily', 'expectancy', 'patience', 'holdTimeDistribution', 'holdTime'
        ]);
        const savedVisibility = await getSetting('pipsuite_dashboard_visibility', {
            assetMatrix: true, tags: true, heatmap: true, hourly: true, daily: true, expectancy: true, patience: true, holdTimeDistribution: true, holdTime: true,
        });
        
        setWidgetOrder(prev => {
            const missing = prev.filter(key => !savedOrder.includes(key));
            return [...savedOrder, ...missing];
        });
        
        setVisibleWidgets(prev => ({...prev, ...savedVisibility}));
        setIsSettingsLoaded(true);
    };
    loadSettings();
  }, []);

  useEffect(() => {
      if (isSettingsLoaded) {
          saveSetting('pipsuite_dashboard_order', widgetOrder);
      }
  }, [widgetOrder, isSettingsLoaded]);

  useEffect(() => {
      if (isSettingsLoaded) {
          saveSetting('pipsuite_dashboard_visibility', visibleWidgets);
      }
  }, [visibleWidgets, isSettingsLoaded]);

  const dashboardTrades = useMemo(() => {
      let filtered = trades;
      if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          
          filtered = filtered.filter(t => {
              const d = new Date(t.entryDate || t.createdAt);
              return d >= start && d <= end;
          });
      }
      if (activeTagFilter.length > 0) {
          filtered = filtered.filter(t => activeTagFilter.every(tag => t.tags.includes(tag)));
      }
      if (activeAssetFilter.length > 0) {
          filtered = filtered.filter(t => activeAssetFilter.includes(t.symbol));
      }
      return filtered;
  }, [trades, activeTagFilter, activeAssetFilter, startDate, endDate]);

  const closedTrades = useMemo(() => dashboardTrades.filter(t => t.outcome === TradeOutcome.CLOSED), [dashboardTrades]);

  const dashboardStats = useMemo(() => {
      // Use ALL filtered trades for Net PnL (to reflect current reality), but calculate win rate on CLOSED only
      const totalTrades = closedTrades.length;
      if (totalTrades === 0) {
          // If no closed trades, stats are empty except maybe open PnL
          const openPnL = dashboardTrades.reduce((acc, t) => acc + t.pnl, 0);
          return { totalTrades: dashboardTrades.length, winRate: 0, netPnL: openPnL, avgWin: 0, avgLoss: 0, profitFactor: 0 };
      }

      const wins = closedTrades.filter(t => t.pnl > 0);
      const losses = closedTrades.filter(t => t.pnl <= 0);
      
      const totalWin = wins.reduce((a, b) => a + b.pnl, 0);
      const totalLoss = Math.abs(losses.reduce((a, b) => a + b.pnl, 0));
      
      const netPnL = dashboardTrades.reduce((acc, t) => acc + t.pnl, 0); // Include Open PnL
      const winRate = (wins.length / totalTrades) * 100;
      const avgWin = wins.length ? totalWin / wins.length : 0;
      const avgLoss = losses.length ? totalLoss / losses.length : 0;
      const profitFactor = totalLoss === 0 ? (totalWin > 0 ? Infinity : 0) : totalWin / totalLoss;

      return { totalTrades, winRate, netPnL, avgWin, avgLoss, profitFactor };
  }, [dashboardTrades, closedTrades]);

  const currentStreak = useMemo(() => {
      // Logic: Only closed trades, sorted by date DESC
      const validTrades = closedTrades
          .filter(t => t.status === TradeStatus.WIN || t.status === TradeStatus.LOSS || t.status === TradeStatus.BREAK_EVEN)
          .sort((a,b) => {
              const bd = new Date(b.exitDate || b.entryDate || b.createdAt || 0).getTime();
              const ad = new Date(a.exitDate || a.entryDate || a.createdAt || 0).getTime();
              return bd - ad;
          });
      
      if (validTrades.length === 0) return { count: 0, type: 'neutral' };

      const first = validTrades[0];
      const type = first.pnl > 0 ? 'WIN' : first.pnl < 0 ? 'LOSS' : 'BE';
      if (type === 'BE') return { count: 0, type: 'neutral' };

      let count = 0;
      for (const t of validTrades) {
          const tType = t.pnl > 0 ? 'WIN' : t.pnl < 0 ? 'LOSS' : 'BE';
          if (tType === type) count++;
          else break;
      }
      return { count, type };
  }, [closedTrades]);

  const avgRRRatio = useMemo(() => {
      let totalRR = 0;
      let count = 0;
      closedTrades.forEach(t => {
          if (!t.entryPrice || !t.stopLoss || !t.takeProfit) return;
          const risk = Math.abs(t.entryPrice - t.stopLoss);
          const reward = Math.abs(t.takeProfit - t.entryPrice);
          if (risk <= 0) return;
          const rr = reward / risk;
          totalRR += rr;
          count++;
      });
      return count > 0 ? (totalRR / count).toFixed(2) : '0.00';
  }, [closedTrades]);

  const heatmapData = useMemo(() => {
      const data: Record<string, number> = {};
      dashboardTrades.forEach(t => {
          // Use consistent local date key
          const dateStr = getCalendarDateKey(t.entryDate || t.createdAt);
          data[dateStr] = (data[dateStr] || 0) + t.pnl;
      });
      return data;
  }, [dashboardTrades]);

  const hourlyData = useMemo(() => {
      const map = new Array(24).fill(0);
      closedTrades.forEach(t => {
          const h = new Date(t.entryDate).getHours();
          map[h] += t.pnl;
      });
      return map.map((val, h) => {
          let label = `${h}:00`;
          if (hourlyFormat12) {
              const suffix = h >= 12 ? 'PM' : 'AM';
              const h12 = h % 12 || 12;
              label = `${h12}${suffix}`;
          }
          return { hour: label, pnl: val, sortIndex: h };
      });
  }, [closedTrades, hourlyFormat12]);

  const dailyData = useMemo(() => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const map = new Array(7).fill(0);
      closedTrades.forEach(t => {
          const d = new Date(t.entryDate).getDay();
          map[d] += t.pnl;
      });
      return [1,2,3,4,5].map(d => ({ day: days[d], pnl: map[d] }));
  }, [closedTrades]);

  const expectancyData = useMemo(() => {
      const groups: Record<string, Trade[]> = {};
      closedTrades.forEach(t => {
          const s = t.setup || 'No Setup';
          if (!groups[s]) groups[s] = [];
          groups[s].push(t);
      });
      
      let result = Object.entries(groups).map(([setup, trades]) => {
          const wins = trades.filter(t => t.pnl > 0);
          const losses = trades.filter(t => t.pnl <= 0);
          const winRate = wins.length / trades.length;
          const lossRate = losses.length / trades.length;
          const avgWin = wins.length > 0 ? wins.reduce((a,b) => a+b.pnl,0)/wins.length : 0;
          const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a,b) => a+b.pnl,0)/losses.length) : 0;
          const expectancy = (winRate * avgWin) - (lossRate * avgLoss);
          return { setup, expectancy, count: trades.length };
      });

      result.sort((a,b) => b.expectancy - a.expectancy);
      if (visibleSetups.length > 0) {
          result = result.filter(item => visibleSetups.includes(item.setup));
      } else {
          result = result.slice(0, 8);
      }
      return result;
  }, [closedTrades, visibleSetups]);

  const allSetups = useMemo(() => {
      const s = new Set<string>();
      dashboardTrades.forEach(t => s.add(t.setup || 'No Setup'));
      return Array.from(s).sort();
  }, [dashboardTrades]);

  const patienceData = useMemo(() => {
      // Must filter out open trades or missing entry/exit dates to avoid NaN
      const sorted = [...closedTrades]
        .filter(t => t.exitDate && t.entryDate) 
        .sort((a,b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());
      
      const buckets = {
          '1-30m': 0, '30m-1h': 0, '1h-2h': 0, '2h-3h': 0, '3h-4h': 0, '4h-5h': 0,
          '5h-6h': 0, '6h-8h': 0, '8h-12h': 0, '12h-24h': 0, '> 24h': 0,
      };
      
      const bucketPnl = { ...buckets }; 

      sorted.forEach((t, i) => {
          if (i === 0) return; 
          const prev = sorted[i-1];
          if (!prev.exitDate) return; 

          const diffMs = new Date(t.entryDate).getTime() - new Date(prev.exitDate).getTime();
          const diffMins = diffMs / 1000 / 60;

          if (diffMins < 0) return; 

          let key = '';
          if (diffMins < 30) key = '1-30m';
          else if (diffMins < 60) key = '30m-1h';
          else if (diffMins < 120) key = '1h-2h';
          else if (diffMins < 180) key = '2h-3h';
          else if (diffMins < 240) key = '3h-4h';
          else if (diffMins < 300) key = '4h-5h';
          else if (diffMins < 360) key = '5h-6h';
          else if (diffMins < 480) key = '6h-8h';
          else if (diffMins < 720) key = '8h-12h';
          else if (diffMins < 1440) key = '12h-24h';
          else key = '> 24h';
          
          if (key) {
              // @ts-ignore
              buckets[key]++;
              // @ts-ignore
              bucketPnl[key] += t.pnl;
          }
      });

      return Object.entries(buckets)
        .map(([range, count]) => ({ 
            range, 
            count, 
            // @ts-ignore
            pnl: bucketPnl[range] 
        }))
        .filter(d => d.count >= 0); 
  }, [closedTrades]);

  const holdTimeDistributionData = useMemo(() => {
      const buckets = {
          '1-30m': 0, '30m-1h': 0, '1h-2h': 0, '2h-3h': 0, '3h-4h': 0, '4h-5h': 0,
          '5h-6h': 0, '6h-8h': 0, '8h-12h': 0, '12h-24h': 0, '> 24h': 0,
      };
      
      const bucketPnl = { ...buckets };

      closedTrades.forEach(t => {
          if (!t.exitDate || !t.entryDate) return;
          const diffMs = new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
          const diffMins = diffMs / 1000 / 60;
          if (diffMins <= 0) return;

          let key = '';
          if (diffMins < 30) key = '1-30m';
          else if (diffMins < 60) key = '30m-1h';
          else if (diffMins < 120) key = '1h-2h';
          else if (diffMins < 180) key = '2h-3h';
          else if (diffMins < 240) key = '3h-4h';
          else if (diffMins < 300) key = '4h-5h';
          else if (diffMins < 360) key = '5h-6h';
          else if (diffMins < 480) key = '6h-8h';
          else if (diffMins < 720) key = '8h-12h';
          else if (diffMins < 1440) key = '12h-24h';
          else key = '> 24h';

          // @ts-ignore
          buckets[key]++;
          // @ts-ignore
          bucketPnl[key] += t.pnl;
      });

      return Object.entries(buckets)
        .map(([range, count]) => ({ 
            range, 
            count, 
            // @ts-ignore
            pnl: bucketPnl[range] 
        }))
        .filter(d => d.count >= 0);
  }, [closedTrades]);

  const holdTimeData = useMemo(() => {
      return closedTrades
          .filter(t => t.exitDate)
          .map(t => {
              const start = new Date(t.entryDate).getTime();
              const end = new Date(t.exitDate!).getTime();
              const minutes = (end - start) / 1000 / 60;
              return {
                  minutes: Math.round(minutes),
                  pnl: t.pnl,
              };
          })
          .filter(d => d.minutes > 0 && d.minutes < 1440);
  }, [closedTrades]);

  const calculateMatrixStats = (items: string[], getItems: (t: Trade) => string[]): Record<string, MatrixStats> => {
      const stats: Record<string, MatrixStats> = {};
      items.forEach(i => { stats[i] = { count: 0, wins: 0, pnl: 0 }; });
      closedTrades.forEach(t => { 
          getItems(t).forEach(item => {
              if (!stats[item]) stats[item] = { count: 0, wins: 0, pnl: 0 };
              const stat = stats[item];
              stat.count++;
              stat.pnl += t.pnl;
              if (t.pnl > 0) stat.wins++;
          });
      });
      return stats;
  };

  const tagStats = useMemo(() => {
      const allTags = tagGroups.flatMap(g => g.tags);
      return calculateMatrixStats(allTags, (t) => t.tags);
  }, [closedTrades, tagGroups]);

  const assetStats = useMemo(() => {
      const allAssets = Array.from(new Set<string>(closedTrades.map(t => t.symbol)));
      return calculateMatrixStats(allAssets, (t) => [t.symbol]);
  }, [closedTrades]);

  const toggleTagFilter = (tag: string) => {
      setActiveTagFilter(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const toggleAssetFilter = (asset: string) => {
      setActiveAssetFilter(prev => prev.includes(asset) ? prev.filter(a => a !== asset) : [...prev, asset]);
  };

  const handleDragStart = (e: React.DragEvent, key: string) => {
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => {
          setDraggedWidget(key);
      }, 0);
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, targetKey: string) => {
      e.preventDefault();
      if (!draggedWidget || draggedWidget === targetKey) return;
      
      const oldIndex = widgetOrder.indexOf(draggedWidget);
      const newIndex = widgetOrder.indexOf(targetKey);
      
      if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = [...widgetOrder];
          newOrder.splice(oldIndex, 1);
          newOrder.splice(newIndex, 0, draggedWidget);
          setWidgetOrder(newOrder);
      }
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
      e.preventDefault();
      setDraggedWidget(null);
  };

  const renderHeatmap = () => {
      const weeksToShow = 52; 
      const now = new Date();
      const weeks = [];
      const startDateCalc = new Date();
      startDateCalc.setDate(now.getDate() - ((weeksToShow - 1) * 7));
      startDateCalc.setDate(startDateCalc.getDate() - startDateCalc.getDay()); 

      for (let w = 0; w < weeksToShow; w++) {
          const weekDays = [];
          for (let d = 0; d < 7; d++) {
              const iterDate = new Date(startDateCalc); 
              // Uses consistent local YYYY-MM-DD key logic
              const dateStr = getCalendarDateKey(iterDate);
              const pnl = heatmapData[dateStr];
              
              let bg = 'bg-surfaceHighlight';
              let title = '';
              const formattedDate = iterDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

              if (pnl !== undefined) {
                  title = `${formattedDate}: $${pnl.toFixed(2)}`;
                  if (pnl > 0) bg = 'bg-profit/80';
                  if (pnl > 100) bg = 'bg-profit';
                  if (pnl < 0) bg = 'bg-loss/80';
                  if (pnl < -100) bg = 'bg-loss';
              } else {
                  title = `${formattedDate}: No Trade`;
              }

              weekDays.push(
                  <div 
                    key={d} 
                    className={`flex-1 w-full rounded-[2px] ${bg} hover:ring-1 ring-textMain/50 transition-all cursor-default min-h-0`} 
                    title={title} 
                  />
              );
              startDateCalc.setDate(startDateCalc.getDate() + 1);
          }
          weeks.push(
            <div key={w} className="flex-1 flex flex-col gap-[2px] min-w-0 h-full">
                {weekDays}
            </div>
          );
      }

      const splitIndex = Math.ceil(weeksToShow / 2);
      const firstRow = weeks.slice(0, splitIndex);
      const secondRow = weeks.slice(splitIndex);

      return (
        <div className="flex-1 flex flex-col gap-3 min-h-0 w-full">
            <div className="flex-1 flex gap-[2px] w-full min-h-0">
                {firstRow}
            </div>
            <div className="flex-1 flex gap-[2px] w-full min-h-0">
                {secondRow}
            </div>
        </div>
      );
  };

  const isFiltered = activeTagFilter.length > 0 || activeAssetFilter.length > 0 || (startDate && endDate);

  const renderWidget = (key: string) => {
      switch(key) {
          case 'assetMatrix': return (
              <WidgetContainer 
                title="Asset Impact Matrix" 
                icon={DollarSign}
                tooltipTitle="Asset Filtering"
                tooltipContent={<><p><strong>What:</strong> Performance statistics for every asset pair you have traded.</p><p><strong>Use:</strong> Click any asset to filter the dashboard.</p></>}
                onDragHandleMouseDown={() => {}}
              >
                  <div className="overflow-auto h-full pr-1 scrollbar-thin">
                      <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-surfaceHighlight text-textMuted uppercase tracking-wider sticky top-0 z-10">
                              <tr>
                                  <th className="p-2 bg-surfaceHighlight">Asset Pair</th>
                                  <th className="p-2 text-right bg-surfaceHighlight">Count</th>
                                  <th className="p-2 text-right bg-surfaceHighlight">Win%</th>
                                  <th className="p-2 text-right bg-surfaceHighlight">Total $</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                              {Object.entries(assetStats).sort((a: [string, MatrixStats], b: [string, MatrixStats]) => b[1].pnl - a[1].pnl).map(([asset, s]: [string, MatrixStats]) => {
                                  const winRate = s.count > 0 ? (s.wins / s.count) * 100 : 0;
                                  const isActive = activeAssetFilter.includes(asset);
                                  return (
                                      <tr 
                                        key={asset} 
                                        onClick={() => toggleAssetFilter(asset)}
                                        style={{ boxShadow: isActive ? 'inset 3px 0 0 0 #6366f1' : 'none' }}
                                        className={`cursor-pointer transition-colors ${isActive ? 'bg-indigo-500/10' : 'hover:bg-surfaceHighlight border-l-2 border-transparent'}`}
                                      >
                                          <td className="p-2 font-medium text-textMain flex items-center gap-2">
                                              <span className={`w-1.5 h-1.5 rounded-full ${s.pnl >= 0 ? 'bg-profit' : 'bg-loss'}`}></span>
                                              {asset}
                                          </td>
                                          <td className="p-2 text-right font-mono">{s.count}</td>
                                          <td className="p-2 text-right font-mono">{winRate.toFixed(0)}%</td>
                                          <td className={`p-2 text-right font-mono font-bold ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>${s.pnl.toFixed(0)}</td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                      </table>
                      {Object.keys(assetStats).length === 0 && <div className="p-6 text-center text-textMuted italic text-xs">No assets found in current view.</div>}
                  </div>
              </WidgetContainer>
          );
          case 'tags': return (
              <WidgetContainer 
                title="Tag Impact Matrix" 
                icon={Filter}
                tooltipTitle="Detailed Factor Analysis"
                tooltipContent={<><p><strong>What:</strong> A breakdown of your performance statistics for every tag used.</p><p><strong>Use:</strong> Click any tag to filter the <strong>entire dashboard</strong> (AND logic).</p></>}
                onDragHandleMouseDown={() => {}}
              >
                  <div className="overflow-auto h-full pr-1 scrollbar-thin">
                      <table className="w-full text-xs text-left border-collapse">
                          <thead className="bg-surfaceHighlight text-textMuted uppercase tracking-wider sticky top-0 z-10">
                              <tr>
                                  <th className="p-2 bg-surfaceHighlight">Tag Name</th>
                                  <th className="p-2 text-right bg-surfaceHighlight">Count</th>
                                  <th className="p-2 text-right bg-surfaceHighlight">Win%</th>
                                  <th className="p-2 text-right bg-surfaceHighlight">Total $</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                              {tagGroups.map(group => {
                                  const activeTags = group.tags.filter(t => tagStats[t]?.count > 0);
                                  if (activeTags.length === 0) return null;
                                  return (
                                      <React.Fragment key={group.name}>
                                          <tr className="bg-surfaceHighlight/30">
                                              <td colSpan={4} className="py-1 px-2 text-[9px] font-bold text-textMuted uppercase tracking-widest">{group.name}</td>
                                          </tr>
                                          {activeTags.map(tag => {
                                              const s = tagStats[tag];
                                              const winRate = (s.wins / s.count) * 100;
                                              const isActive = activeTagFilter.includes(tag);
                                              return (
                                                  <tr 
                                                    key={tag} 
                                                    onClick={() => toggleTagFilter(tag)}
                                                    style={{ boxShadow: isActive ? 'inset 3px 0 0 0 #3b82f6' : 'none' }}
                                                    className={`cursor-pointer transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-surfaceHighlight'}`}
                                                  >
                                                      <td className="p-2 font-medium text-textMain flex items-center gap-2">
                                                          <span className={`w-1.5 h-1.5 rounded-full ${s.pnl >= 0 ? 'bg-profit' : 'bg-loss'}`}></span>
                                                          {tag}
                                                      </td>
                                                      <td className="p-2 text-right font-mono">{s.count}</td>
                                                      <td className="p-2 text-right font-mono">{winRate.toFixed(0)}%</td>
                                                      <td className={`p-2 text-right font-mono font-bold ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>${s.pnl.toFixed(0)}</td>
                                                  </tr>
                                              )
                                          })}
                                      </React.Fragment>
                                  );
                              })}
                          </tbody>
                      </table>
                      {Object.keys(tagStats).filter(t => tagStats[t].count > 0).length === 0 && <div className="p-6 text-center text-textMuted italic text-xs">No tagged trades found.</div>}
                  </div>
              </WidgetContainer>
          );
          case 'heatmap': return (
            <WidgetContainer 
                title="Calendar Heatmap" 
                icon={CalendarIcon} 
                tooltipTitle="Consistency Visualizer"
                tooltipContent={<><p><strong>What:</strong> A calendar view (last 12 months) where each square represents a trading day. Green indicates profit, red indicates loss.</p><p><strong>Goal:</strong> Build a "chain" of green days.</p></>}
                onDragHandleMouseDown={() => {}}
            >
                <div className="flex flex-col h-full w-full pb-2">
                    {renderHeatmap()}
                    <div className="flex justify-center items-center gap-4 mt-3 text-[9px] text-textMuted uppercase font-semibold shrink-0">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-loss rounded-[1px]"></div> Loss</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-surfaceHighlight rounded-[1px]"></div> No Trade</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-profit rounded-[1px]"></div> Profit</div>
                    </div>
                </div>
            </WidgetContainer>
          );
          case 'hourly': return (
            <WidgetContainer 
                title="Hourly Performance" 
                icon={Clock}
                tooltipTitle="Time of Day Analysis"
                tooltipContent={<p><strong>What:</strong> Shows your Net PnL broken down by the hour of the day the trade was opened.</p>}
                controls={
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] text-textMuted uppercase hidden sm:inline">{userTimezone}</span>
                        <button onClick={() => setHourlyFormat12(!hourlyFormat12)} className="text-[10px] border border-border px-1.5 py-0.5 rounded hover:bg-surfaceHighlight">{hourlyFormat12 ? '12H' : '24H'}</button>
                    </div>
                }
                onDragHandleMouseDown={() => {}}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--color-border))" />
                        <XAxis dataKey="hour" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} />
                        <ReferenceLine y={0} stroke="rgb(var(--color-border))" />
                        <Bar dataKey="pnl">
                            {hourlyData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </WidgetContainer>
          );
          case 'daily': return (
            <WidgetContainer 
                title="Day of Week" 
                icon={CalendarIcon}
                tooltipTitle="Weekly Cycle Analysis"
                tooltipContent={<p><strong>What:</strong> Cumulative PnL grouped by day of the week (Mon-Fri).</p>}
                onDragHandleMouseDown={() => {}}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--color-border))" />
                        <XAxis dataKey="day" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} />
                        <ReferenceLine y={0} stroke="rgb(var(--color-border))" />
                        <Bar dataKey="pnl">
                            {dailyData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </WidgetContainer>
          );
          case 'expectancy': return (
              <WidgetContainer 
                title="Expectancy by Setup" 
                icon={Target}
                tooltipTitle="Strategy Edge Validator"
                tooltipContent={<p><strong>What:</strong> Calculates the mathematical "edge" of each setup per trade.</p>}
                controls={<MultiSelectDropdown label="Setups" options={allSetups} selected={visibleSetups} onChange={setVisibleSetups} />}
                onDragHandleMouseDown={() => {}}
              >
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={expectancyData} layout="vertical" margin={{ left: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgb(var(--color-border))" />
                          <XAxis type="number" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="setup" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} width={80} />
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} />
                          <ReferenceLine x={0} stroke="rgb(var(--color-border))" />
                          <Bar dataKey="expectancy" barSize={15}>
                              {expectancyData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.expectancy >= 0 ? '#10b981' : '#ef4444'} />))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </WidgetContainer>
          );
          case 'patience': return (
              <WidgetContainer 
                title="Patience Meter" 
                icon={Hourglass}
                tooltipTitle="Revenge Trading Detector"
                tooltipContent={<><p><strong>What:</strong> Groups your trades by how much time elapsed since the *previous* trade was closed.</p><p><strong>Ranges:</strong> 1-30m, 30m-1h, ... 12h-24h, &gt; 24h.</p></>}
                onDragHandleMouseDown={() => {}}
              >
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={patienceData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--color-border))" />
                          <XAxis dataKey="range" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} />
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} />
                          <ReferenceLine y={0} stroke="rgb(var(--color-border))" />
                          <Bar dataKey="pnl">
                              {patienceData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </WidgetContainer>
          );
          case 'holdTimeDistribution': return (
              <WidgetContainer 
                title="Hold Time Distribution" 
                icon={Timer}
                tooltipTitle="Duration vs Profit"
                tooltipContent={<><p><strong>What:</strong> Buckets your trades by how long they were held (Open to Close).</p><p><strong>Use:</strong> Identify which duration yields the best results.</p></>}
                onDragHandleMouseDown={() => {}}
              >
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={holdTimeDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--color-border))" />
                          <XAxis dataKey="range" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} />
                          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} />
                          <ReferenceLine y={0} stroke="rgb(var(--color-border))" />
                          <Bar dataKey="pnl">
                              {holdTimeDistributionData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />))}
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </WidgetContainer>
          );
          case 'holdTime': return (
              <WidgetContainer 
                title="Hold Time vs PnL (Scatter)" 
                icon={Activity}
                tooltipTitle="Trade Management Analysis"
                tooltipContent={<p><strong>What:</strong> A scatter plot. Each dot is a trade. X-axis is time held (minutes), Y-axis is PnL.</p>}
                onDragHandleMouseDown={() => {}}
              >
                  <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" />
                          <XAxis type="number" dataKey="minutes" name="Minutes" unit="m" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} />
                          <YAxis type="number" dataKey="pnl" name="P&L" unit="$" fontSize={10} stroke="rgb(var(--color-text-muted))" tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-main))' }} />
                          <ReferenceLine y={0} stroke="rgb(var(--color-border))" />
                          <Scatter name="Trades" data={holdTimeData} fill="#8884d8">
                              {holdTimeData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />))}
                          </Scatter>
                      </ScatterChart>
                  </ResponsiveContainer>
              </WidgetContainer>
          );
          default: return null;
      }
  };

  if (!isSettingsLoaded) {
      return (
          <div className="flex h-[500px] w-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <p className="text-textMuted text-sm font-medium">Loading Dashboard Layout...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold text-textMain">Trading Performance</h2>
          <div className="text-textMuted text-xs mt-1 flex flex-wrap gap-2 items-center">
             {(activeTagFilter.length > 0 || activeAssetFilter.length > 0 || (startDate && endDate)) ? (
                 <>
                    Filters:
                    {startDate && endDate && (
                        <span className="px-1.5 py-0.5 bg-surfaceHighlight text-textMain border border-border rounded font-medium flex items-center gap-1">
                            {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                            <X size={10} className="cursor-pointer" onClick={() => { setStartDate(''); setEndDate(''); }} />
                        </span>
                    )}
                    {activeTagFilter.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-medium flex items-center gap-1">
                            {tag} <X size={10} className="cursor-pointer" onClick={() => toggleTagFilter(tag)} />
                        </span>
                    ))}
                    {activeAssetFilter.map(asset => (
                        <span key={asset} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded font-medium flex items-center gap-1">
                            {asset} <X size={10} className="cursor-pointer" onClick={() => toggleAssetFilter(asset)} />
                        </span>
                    ))}
                 </>
             ) : 'Global Analysis'}
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
            <div className="flex items-center gap-2 bg-surfaceHighlight border border-border p-1 rounded-lg">
                <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-xs text-textMain focus:ring-0 cursor-pointer font-medium p-0.5 w-24"
                    title="Start Date"
                />
                <span className="text-textMuted text-xs">-</span>
                <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-xs text-textMain focus:ring-0 cursor-pointer font-medium p-0.5 w-24"
                    title="End Date"
                />
            </div>

            {(activeTagFilter.length > 0 || activeAssetFilter.length > 0 || (startDate && endDate)) && (
                <button 
                   onClick={() => { setActiveTagFilter([]); setActiveAssetFilter([]); setStartDate(''); setEndDate(''); }}
                   className="flex items-center gap-2 px-3 py-1.5 bg-loss/10 text-loss rounded-lg text-xs font-bold border border-loss/20 hover:bg-loss/20"
                >
                    <X size={12} /> Clear
                </button>
            )}
            <button 
                onClick={() => setIsConfigOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs hover:bg-surfaceHighlight text-textMain"
            >
                <Settings size={14} /> Customize Layout
            </button>
        </div>
      </div>

      {isConfigOpen && (
          <div 
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4 backdrop-blur-sm"
            onClick={() => setIsConfigOpen(false)}
          >
              <div className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold">Dashboard Widgets</h3>
                      <button onClick={() => setIsConfigOpen(false)}><X size={18}/></button>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {Object.keys(visibleWidgets).map(key => (
                          <label key={key} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:bg-surfaceHighlight cursor-pointer">
                              <span className="capitalize text-sm">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <input 
                                type="checkbox" 
                                checked={(visibleWidgets as any)[key]} 
                                onChange={() => setVisibleWidgets(prev => ({...prev, [key]: !(prev as any)[key]}))} 
                                className="rounded text-primary focus:ring-primary"
                              />
                          </label>
                      ))}
                  </div>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <VitalCard label="Net P&L" value={`$${dashboardStats.netPnL.toLocaleString()}`} colorClass={dashboardStats.netPnL >= 0 ? 'text-profit' : 'text-loss'} icon={Activity} subValue={`${dashboardStats.totalTrades} Trades`} />
        <VitalCard label="Win Rate" value={`${dashboardStats.winRate.toFixed(1)}%`} colorClass="text-textMain" icon={Target} subValue={`Avg Win: $${dashboardStats.avgWin.toFixed(0)}`} trend={dashboardStats.winRate > 50 ? 'up' : 'down'} />
        <VitalCard label="Profit Factor" value={dashboardStats.profitFactor === Infinity ? '∞' : dashboardStats.profitFactor.toFixed(2)} colorClass="text-textMain" icon={BarChart2} subValue={`Avg Loss: $${dashboardStats.avgLoss.toFixed(0)}`} />
        <VitalCard label="Avg RR Ratio" value={avgRRRatio} colorClass="text-primary" icon={Zap} subValue="Planned" />
        <VitalCard 
            label="Current Streak" 
            value={currentStreak.count} 
            colorClass={currentStreak.type === 'WIN' ? 'text-profit' : currentStreak.type === 'LOSS' ? 'text-loss' : 'text-textMuted'} 
            icon={TrendingUp} 
            subValue={currentStreak.type} 
            isFaded={isFiltered}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {widgetOrder.map(key => {
              if (!visibleWidgets[key as keyof typeof visibleWidgets]) return null;
              const isDragging = draggedWidget === key;
              return (
                  <div 
                    key={key} 
                    className="h-full transition-all duration-300 ease-out"
                    draggable
                    onDragStart={(e) => handleDragStart(e, key)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, key)}
                    onDrop={(e) => handleDrop(e, key)}
                  >
                      {isDragging ? (
                          <div className="w-full h-full border-2 border-dashed border-border/60 rounded-xl bg-surfaceHighlight/5 min-h-[360px] animate-pulse"></div>
                      ) : (
                          renderWidget(key)
                      )}
                  </div>
              );
          })}
      </div>
    </div>
  );
};

export default Dashboard;
