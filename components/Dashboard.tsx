
import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  Legend
} from 'recharts';
import { Trade, TradeStats, TagGroup, TradeOutcome, TradeStatus } from '../types';
import { 
  TrendingUp, 
  Target, 
  Activity, 
  BarChart2, 
  Zap, 
  Calendar as CalendarIcon, 
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  DollarSign,
  PieChart as PieChartIcon,
  Clock,
  Tags
} from 'lucide-react';

interface DashboardProps {
  stats: TradeStats; 
  trades: Trade[];
  tagGroups: TagGroup[];
}

// --- Helper Components ---

const VitalCard = ({ label, value, subValue, trend, icon: Icon, colorClass, isFaded = false }: any) => (
  <div className={`bg-surface border border-border rounded-xl p-5 flex flex-col justify-between hover:border-primary/30 transition-all shadow-sm relative overflow-hidden group h-[120px] ${isFaded ? 'opacity-50 grayscale-[0.5]' : ''}`}>
    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Icon size={64} /></div>
    <div>
        <p className="text-[10px] uppercase tracking-wider text-textMuted font-bold flex items-center gap-1.5 mb-2">
            <Icon size={12} /> {label}
        </p>
        <h3 className={`text-3xl font-bold tracking-tight ${colorClass}`}>{value}</h3>
    </div>
    {subValue && (
        <div className="mt-2 text-xs font-medium text-textMuted flex items-center gap-1">
            {trend === 'up' && <ArrowUpRight size={14} className="text-profit" />}
            {trend === 'down' && <ArrowDownRight size={14} className="text-loss" />}
            {subValue}
        </div>
    )}
  </div>
);

const WidgetContainer = ({ title, icon: Icon, children, className = '' }: any) => (
  <div className={`bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col ${className}`}>
    <div className="flex items-center justify-between mb-6 pb-2 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-surfaceHighlight rounded-md text-primary">
                <Icon size={16} />
            </div>
            <h3 className="font-bold text-sm text-textMain uppercase tracking-wide">{title}</h3>
        </div>
    </div>
    <div className="flex-1 w-full min-h-0 relative">{children}</div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border p-3 rounded-lg shadow-xl text-xs">
        <p className="font-bold text-textMain mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            {entry.name}: {typeof entry.value === 'number' ? (entry.name.toLowerCase().includes('p&l') ? `$${entry.value.toFixed(2)}` : entry.value) : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC<DashboardProps> = ({ trades, tagGroups }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // 1. Filter Logic
  const dashboardTrades = useMemo(() => {
      let filtered = trades.filter(t => !t.isDeleted); // Basic filter
      
      if (startDate) {
          const start = new Date(startDate).getTime();
          filtered = filtered.filter(t => new Date(t.entryDate || t.createdAt).getTime() >= start);
      }
      if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter(t => new Date(t.entryDate || t.createdAt).getTime() <= end.getTime());
      }
      return filtered.sort((a, b) => new Date(a.entryDate || a.createdAt).getTime() - new Date(b.entryDate || b.createdAt).getTime());
  }, [trades, startDate, endDate]);

  const closedTrades = useMemo(() => dashboardTrades.filter(t => t.outcome === TradeOutcome.CLOSED), [dashboardTrades]);

  // 2. Stats Calculation
  const stats = useMemo(() => {
      const wins = closedTrades.filter(t => t.pnl > 0);
      const losses = closedTrades.filter(t => t.pnl <= 0);
      
      const totalWinPnl = wins.reduce((sum, t) => sum + t.pnl, 0);
      const totalLossPnl = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
      const netPnL = totalWinPnl - totalLossPnl;
      
      const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
      const profitFactor = totalLossPnl === 0 ? (totalWinPnl > 0 ? 999 : 0) : totalWinPnl / totalLossPnl;
      
      const avgWin = wins.length ? totalWinPnl / wins.length : 0;
      const avgLoss = losses.length ? totalLossPnl / losses.length : 0;
      const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss);

      return {
          netPnL,
          winRate,
          profitFactor,
          expectancy,
          totalTrades: closedTrades.length,
          avgWin,
          avgLoss
      };
  }, [closedTrades]);

  // 3. Chart Data Preparation

  // Cumulative P&L
  const pnlOverTimeData = useMemo(() => {
      let runningTotal = 0;
      return closedTrades.map(t => {
          runningTotal += t.pnl;
          return {
              date: new Date(t.entryDate || t.createdAt).toLocaleDateString(),
              pnl: runningTotal,
              tradePnl: t.pnl
          };
      });
  }, [closedTrades]);

  // Daily P&L
  const dailyPnlData = useMemo(() => {
      const map = new Map<string, number>();
      closedTrades.forEach(t => {
          const date = new Date(t.entryDate || t.createdAt).toLocaleDateString();
          map.set(date, (map.get(date) || 0) + t.pnl);
      });
      return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
  }, [closedTrades]);

  // Win/Loss Distribution
  const distributionData = useMemo(() => [
      { name: 'Wins', value: closedTrades.filter(t => t.pnl > 0).length, color: '#10b981' },
      { name: 'Losses', value: closedTrades.filter(t => t.pnl < 0).length, color: '#ef4444' },
      { name: 'Break Even', value: closedTrades.filter(t => t.pnl === 0).length, color: '#94a3b8' }
  ].filter(d => d.value > 0), [closedTrades]);

  // Setup Performance
  const setupPerformanceData = useMemo(() => {
      const map = new Map<string, { pnl: number, count: number, wins: number }>();
      closedTrades.forEach(t => {
          const setup = t.setup || 'No Setup';
          const current = map.get(setup) || { pnl: 0, count: 0, wins: 0 };
          map.set(setup, {
              pnl: current.pnl + t.pnl,
              count: current.count + 1,
              wins: current.wins + (t.pnl > 0 ? 1 : 0)
          });
      });
      return Array.from(map.entries())
          .map(([name, data]) => ({ name, ...data, winRate: (data.wins / data.count) * 100 }))
          .sort((a, b) => b.pnl - a.pnl)
          .slice(0, 8);
  }, [closedTrades]);

  // Hourly Performance
  const hourlyData = useMemo(() => {
      const hours = Array(24).fill(0).map((_, i) => ({ hour: i, pnl: 0, count: 0 }));
      closedTrades.forEach(t => {
          const d = new Date(t.entryDate || t.createdAt);
          const h = d.getHours();
          hours[h].pnl += t.pnl;
          hours[h].count += 1;
      });
      return hours.map(h => ({
          name: `${h.hour}:00`,
          value: h.pnl,
          count: h.count
      }));
  }, [closedTrades]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Vitals Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <VitalCard 
            label="Net P&L" 
            value={`$${stats.netPnL.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`} 
            trend={stats.netPnL >= 0 ? 'up' : 'down'} 
            icon={DollarSign} 
            colorClass={stats.netPnL >= 0 ? 'text-profit' : 'text-loss'} 
        />
        <VitalCard 
            label="Win Rate" 
            value={`${stats.winRate.toFixed(1)}%`} 
            subValue={`${stats.totalTrades} Trades`}
            trend={stats.winRate >= 50 ? 'up' : 'down'} 
            icon={Target} 
            colorClass={stats.winRate >= 50 ? 'text-profit' : 'text-loss'} 
        />
        <VitalCard 
            label="Profit Factor" 
            value={stats.profitFactor.toFixed(2)} 
            trend={stats.profitFactor >= 1.5 ? 'up' : 'down'} 
            icon={Activity} 
            colorClass={stats.profitFactor >= 1.5 ? 'text-profit' : 'text-textMain'} 
        />
        <VitalCard 
            label="Expectancy" 
            value={`$${stats.expectancy.toFixed(2)}`} 
            subValue="Per Trade"
            trend={stats.expectancy > 0 ? 'up' : 'down'} 
            icon={Zap} 
            colorClass={stats.expectancy > 0 ? 'text-profit' : 'text-loss'} 
        />
      </div>
      
      {/* Filters & Actions */}
      <div className="flex flex-wrap gap-3 items-center bg-surface border border-border p-3 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 px-2 border-r border-border">
              <Filter size={16} className="text-primary" />
              <span className="text-xs font-bold uppercase text-textMuted tracking-wider">Filters</span>
          </div>
          <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="bg-background border border-border rounded px-3 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary" 
              />
              <span className="text-textMuted text-xs">-</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                className="bg-background border border-border rounded px-3 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary" 
              />
          </div>
          <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-textMuted italic">Showing {closedTrades.length} closed trades</span>
          </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Cumulative P&L - Spans 2 Columns */}
          <WidgetContainer title="Cumulative Performance" icon={TrendingUp} className="lg:col-span-2 h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={pnlOverTimeData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                          <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={stats.netPnL >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0.2}/>
                              <stop offset="95%" stopColor={stats.netPnL >= 0 ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.5} />
                      <XAxis dataKey="date" tick={{fontSize: 10, fill: 'var(--color-text-muted)'}} axisLine={false} tickLine={false} minTickGap={30} />
                      <YAxis tick={{fontSize: 10, fill: 'var(--color-text-muted)'}} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-text-muted)', strokeWidth: 1 }} />
                      <Area 
                        type="monotone" 
                        dataKey="pnl" 
                        stroke={stats.netPnL >= 0 ? '#10b981' : '#ef4444'} 
                        fillOpacity={1} 
                        fill="url(#colorPnl)" 
                        strokeWidth={2}
                        name="Cumulative P&L"
                      />
                  </AreaChart>
              </ResponsiveContainer>
          </WidgetContainer>

          {/* Win/Loss Distribution */}
          <WidgetContainer title="Win / Loss Distribution" icon={PieChartIcon} className="h-[350px]">
              <div className="flex h-full items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={distributionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                          >
                              {distributionData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px'}} />
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </WidgetContainer>

          {/* Daily P&L Bar Chart */}
          <WidgetContainer title="Daily P&L" icon={BarChart2} className="h-[300px] lg:col-span-1">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyPnlData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.3} />
                      <XAxis dataKey="date" hide />
                      <YAxis tick={{fontSize: 10, fill: 'var(--color-text-muted)'}} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--color-surface-highlight)'}} />
                      <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="3 3" />
                      <Bar dataKey="value" name="Daily P&L" radius={[4, 4, 0, 0]}>
                          {dailyPnlData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                          ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </WidgetContainer>

          {/* Hourly Performance */}
          <WidgetContainer title="Hourly Performance" icon={Clock} className="h-[300px] lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.3} />
                      <XAxis dataKey="name" tick={{fontSize: 10, fill: 'var(--color-text-muted)'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 10, fill: 'var(--color-text-muted)'}} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'var(--color-surface-highlight)'}} />
                      <ReferenceLine y={0} stroke="var(--color-text-muted)" strokeDasharray="3 3" />
                      <Bar dataKey="value" name="Hourly P&L" radius={[4, 4, 0, 0]}>
                          {hourlyData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                          ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </WidgetContainer>

          {/* Setup Performance List */}
          <WidgetContainer title="Top Strategies" icon={Tags} className="lg:col-span-3 h-auto min-h-[300px]">
              <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                      <thead className="text-xs text-textMuted uppercase bg-surfaceHighlight/50 border-b border-border">
                          <tr>
                              <th className="px-4 py-3 font-medium">Strategy</th>
                              <th className="px-4 py-3 font-medium text-center">Trades</th>
                              <th className="px-4 py-3 font-medium text-center">Win Rate</th>
                              <th className="px-4 py-3 font-medium text-right">Total P&L</th>
                              <th className="px-4 py-3 font-medium text-center w-32">Performance</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                          {setupPerformanceData.map((s, idx) => (
                              <tr key={idx} className="hover:bg-surfaceHighlight/30 transition-colors">
                                  <td className="px-4 py-3 font-medium text-textMain">{s.name}</td>
                                  <td className="px-4 py-3 text-center">{s.count}</td>
                                  <td className="px-4 py-3 text-center">
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.winRate >= 50 ? 'bg-profit/10 text-profit' : 'bg-loss/10 text-loss'}`}>
                                          {s.winRate.toFixed(0)}%
                                      </span>
                                  </td>
                                  <td className={`px-4 py-3 text-right font-bold font-mono ${s.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                      ${s.pnl.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3">
                                      <div className="w-full bg-border/30 h-1.5 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full ${s.pnl >= 0 ? 'bg-profit' : 'bg-loss'}`} 
                                            style={{ width: `${Math.min(Math.abs(s.pnl) / Math.max(...setupPerformanceData.map(d => Math.abs(d.pnl))) * 100, 100)}%` }}
                                          ></div>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                          {setupPerformanceData.length === 0 && (
                              <tr><td colSpan={5} className="px-4 py-8 text-center text-textMuted italic">No strategy data available.</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </WidgetContainer>

      </div>
    </div>
  );
};

export default Dashboard;
