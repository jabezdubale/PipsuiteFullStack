
import React, { useState, useEffect, useMemo } from 'react';
import { Trade, TradeStatus, MonthlyNoteData } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown, PenLine, Save, BarChart2 } from 'lucide-react';
import { getMonthlyNote, saveMonthlyNote } from '../services/storageService';
import { getCalendarDateKey } from '../utils/dateUtils';

interface CalendarViewProps {
  trades: Trade[];
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  onDayClick: (date: string, trades: Trade[]) => void;
  onWeekClick?: (startDate: string, endDate: string, trades: Trade[]) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ trades, currentMonth, setCurrentMonth, onDayClick, onWeekClick }) => {
  const [noteData, setNoteData] = useState<MonthlyNoteData>({ goals: '', notes: '', review: '' });
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isNoteLoaded, setIsNoteLoaded] = useState(false);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Load Note Effect
  useEffect(() => {
    setIsNoteLoaded(false);
    getMonthlyNote(monthKey).then((data) => {
        setNoteData(data);
        setIsNoteLoaded(true);
    });
  }, [monthKey]);

  // Save Note Effect (Debounce)
  useEffect(() => {
    if (!isNoteLoaded) return;
    
    // Set saving state immediately if text changed
    setIsSavingNote(true);

    const timer = setTimeout(() => {
        saveMonthlyNote(monthKey, noteData).then(() => {
            setIsSavingNote(false);
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [noteData, monthKey, isNoteLoaded]);

  const handleNoteChange = (field: keyof MonthlyNoteData, value: string) => {
      setNoteData(prev => ({ ...prev, [field]: value }));
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  
  // Handler for direct date jump
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.value) return;
      const [y, m] = e.target.value.split('-');
      setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
  };

  // Organize trades by date using consistent local key
  const tradesByDate = useMemo(() => {
      const map: Record<string, Trade[]> = {};
      trades.forEach(trade => {
        const dateSource = trade.entryDate || trade.createdAt;
        const dateStr = getCalendarDateKey(dateSource); // Uses utils for consistency
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(trade);
      });
      return map;
  }, [trades]);

  // --- Date Calculation for Calendar Grid ---
  const weeks = useMemo(() => {
      const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
      const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

      const daysInMonth = getDaysInMonth(year, month);
      const firstDay = getFirstDayOfMonth(year, month);

      const allDays = [];

      // 1. Previous Month Padding
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      for (let i = 0; i < firstDay; i++) {
          const dayNum = prevMonthLastDay - firstDay + 1 + i;
          const dateObj = new Date(year, month - 1, dayNum);
          allDays.push({ day: dayNum, date: dateObj, dateStr: getCalendarDateKey(dateObj), isOutside: true });
      }

      // 2. Current Month Days
      for (let d = 1; d <= daysInMonth; d++) {
          const dateObj = new Date(year, month, d);
          allDays.push({ day: d, date: dateObj, dateStr: getCalendarDateKey(dateObj), isOutside: false });
      }

      // 3. Next Month Padding
      const currentCount = allDays.length;
      const remainder = currentCount % 7;
      if (remainder !== 0) {
          const toAdd = 7 - remainder;
          for (let j = 1; j <= toAdd; j++) {
              const dateObj = new Date(year, month + 1, j);
              allDays.push({ day: j, date: dateObj, dateStr: getCalendarDateKey(dateObj), isOutside: true });
          }
      }

      // Chunk into weeks
      const chunked = [];
      for (let i = 0; i < allDays.length; i += 7) {
          chunked.push(allDays.slice(i, i + 7));
      }
      return chunked;
  }, [year, month]);

  const renderDayCell = (dayInfo: { day: number, dateStr: string, isOutside: boolean }) => {
      const { day, dateStr, isOutside } = dayInfo;
      const dayTrades = tradesByDate[dateStr] || [];
      const dayPnL = dayTrades.reduce((acc, t) => acc + t.pnl, 0);
      const winCount = dayTrades.filter(t => t.status === TradeStatus.WIN).length;
      
      let dayColorClass = 'bg-surface hover:bg-surfaceHighlight';
      let pnlColorClass = 'text-textMuted';
      
      if (dayTrades.length > 0) {
        if (dayPnL > 0) {
          dayColorClass = 'bg-profit/20 border-profit/30 hover:bg-profit/30';
          pnlColorClass = 'text-profit';
        } else if (dayPnL < 0) {
          dayColorClass = 'bg-loss/20 border-loss/30 hover:bg-loss/30';
          pnlColorClass = 'text-loss';
        }
      }

      if (isOutside) {
          dayColorClass += ' opacity-40 grayscale-[0.6]'; 
      }

      return (
        <div 
          key={dateStr} 
          onClick={() => onDayClick(dateStr, dayTrades)}
          className={`h-32 p-2 flex flex-col justify-between transition-colors cursor-pointer relative group border-r border-b border-border last:border-r-0 ${dayColorClass}`}
        >
          <span className={`text-sm font-medium ${isOutside ? 'text-textMuted' : 'text-textMuted group-hover:text-textMain'}`}>{day}</span>
          
          {dayTrades.length > 0 && (
            <div className="flex flex-col items-center justify-center flex-1">
               <div className={`text-lg font-bold ${pnlColorClass}`}>
                 {dayPnL < 0 ? '-' : ''}${Math.abs(dayPnL).toLocaleString()}
               </div>
               <div className="text-[10px] text-textMuted uppercase tracking-wider mt-1 flex gap-2">
                 <span>{dayTrades.length} Trades</span>
               </div>
               {/* Mini Winrate Bar */}
               <div className="w-16 h-1 bg-gray-700/50 rounded-full mt-2 overflow-hidden">
                 <div 
                   className="h-full bg-profit" 
                   style={{width: `${(winCount/dayTrades.length)*100}%`}}
                 />
               </div>
            </div>
          )}
        </div>
      );
  };

  const renderWeeklyStats = (weekDays: any[]) => {
      let weeklyPnL = 0;
      let totalTrades = 0;
      let wins = 0;
      let weekTrades: Trade[] = [];

      weekDays.forEach(d => {
          const tList = tradesByDate[d.dateStr] || [];
          weekTrades.push(...tList);
          totalTrades += tList.length;
          weeklyPnL += tList.reduce((acc, t) => acc + t.pnl, 0);
          wins += tList.filter(t => t.status === TradeStatus.WIN).length;
      });

      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

      let bgClass = '';
      if (weeklyPnL > 0) {
          bgClass = 'bg-profit/20';
      } else if (weeklyPnL < 0) {
          bgClass = 'bg-loss/20';
      }

      const handleWeekClick = () => {
          if (onWeekClick && weekDays.length > 0) {
              const startDate = weekDays[0].dateStr;
              const endDate = weekDays[weekDays.length - 1].dateStr;
              onWeekClick(startDate, endDate, weekTrades);
          }
      };

      return (
          <div 
            className={`h-32 flex flex-col justify-center px-4 py-2 border-b border-border last:border-b-0 min-w-[160px] cursor-pointer hover:bg-surfaceHighlight/50 transition-colors ${bgClass}`}
            onClick={handleWeekClick}
          >
              <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-textMuted font-bold uppercase tracking-wider">Weekly P&L</span>
              </div>
              <div className={`text-xl font-bold mb-2 ${weeklyPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {weeklyPnL >= 0 ? '+' : ''}${weeklyPnL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              
              <div className="flex justify-between items-center text-xs text-textMuted mb-2">
                  <span>{totalTrades} Trades</span>
                  <span>{winRate.toFixed(0)}% WR</span>
              </div>

              <div className="flex gap-0.5 h-1.5 w-full bg-border/50 rounded-full overflow-hidden">
                  <div className="h-full bg-profit" style={{ width: `${winRate}%` }}></div>
              </div>
          </div>
      );
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const shortMonthName = currentMonth.toLocaleString('default', { month: 'short', year: 'numeric' });

  const monthPnL = trades.filter(t => {
      const dateSource = t.entryDate || t.createdAt;
      const d = new Date(dateSource);
      return d.getMonth() === month && d.getFullYear() === year;
  }).reduce((acc, t) => acc + t.pnl, 0);
  
  const currentMonthValue = `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      {/* CSS Hack: Force WebKit calendar picker indicator to cover the entire input */}
      <style>{`
        .month-input-hack::-webkit-calendar-picker-indicator {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
          cursor: pointer;
        }
      `}</style>
      
      <div className="flex justify-between items-center bg-surface border border-border p-4 rounded-xl">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 bg-surfaceHighlight/30 hover:bg-surfaceHighlight border border-transparent hover:border-border rounded-lg transition-all text-textMuted hover:text-textMain"><ChevronLeft size={20}/></button>
          
          <div 
            className="group relative flex items-center justify-center gap-3 px-6 py-2.5 bg-surfaceHighlight/30 hover:bg-surfaceHighlight border border-transparent hover:border-primary/30 rounded-lg transition-all cursor-pointer select-none min-w-[240px] shadow-sm active:scale-95 overflow-hidden"
          >
              <CalendarIcon size={18} className="text-textMuted group-hover:text-primary transition-colors pointer-events-none" />
              <span className="text-lg font-bold text-textMain group-hover:text-primary transition-colors whitespace-nowrap pointer-events-none">
                  {monthName}
              </span>
              <ChevronDown size={14} className="text-textMuted/50 group-hover:text-primary/50 transition-colors ml-auto pointer-events-none" />
              
              <input 
                  type="month" 
                  value={currentMonthValue}
                  onChange={handleDateSelect}
                  className="month-input-hack absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  title="Change Month"
              />
          </div>

          <button onClick={nextMonth} className="p-2 bg-surfaceHighlight/30 hover:bg-surfaceHighlight border border-transparent hover:border-border rounded-lg transition-all text-textMuted hover:text-textMain"><ChevronRight size={20}/></button>
        </div>
        <div className="flex items-center gap-4">
             <div className="text-right">
                <p className="text-xs text-textMuted uppercase">Monthly Net P&L</p>
                <p className={`text-xl font-bold ${monthPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {monthPnL < 0 ? '-' : ''}${Math.abs(monthPnL).toLocaleString()}
                </p>
             </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
          <div className="flex-1 w-full flex gap-4 overflow-x-auto pb-2">
              <div className="flex-1 min-w-[600px] bg-border border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
                  <div className="grid grid-cols-7 border-b border-border">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="bg-surfaceHighlight p-3 text-center text-xs font-semibold text-textMuted uppercase border-r border-border last:border-r-0">
                            {day}
                        </div>
                      ))}
                  </div>
                  <div className="flex-1 bg-background">
                      {weeks.map((weekDays, wIdx) => (
                          <div key={wIdx} className="grid grid-cols-7 border-b border-border last:border-b-0">
                              {weekDays.map(dayInfo => renderDayCell(dayInfo))}
                          </div>
                      ))}
                  </div>
              </div>

              <div className="w-48 shrink-0 bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col self-stretch">
                  <div className="h-[41px] bg-surfaceHighlight p-3 text-center text-xs font-bold text-textMuted uppercase border-b border-border flex items-center justify-center gap-2">
                      <BarChart2 size={14} /> Weekly Report
                  </div>
                  <div className="flex-1 flex flex-col bg-background">
                      {weeks.map((weekDays, wIdx) => (
                          <div key={wIdx} className="flex-1 border-b border-border last:border-b-0">
                              {renderWeeklyStats(weekDays)}
                          </div>
                      ))}
                  </div>
              </div>
          </div>
          
          <div className="w-full xl:w-80 shrink-0 bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col self-stretch min-h-[600px]">
              <div className="h-[41px] bg-surfaceHighlight/50 p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PenLine size={16} className="text-primary"/>
                    <h3 className="font-bold text-sm text-textMain">{shortMonthName} Notes</h3>
                  </div>
                  {isSavingNote ? (
                      <span className="text-[10px] text-textMuted animate-pulse">Saving...</span>
                  ) : (
                      <span className="text-[10px] text-textMuted flex items-center gap-1"><Save size={10} /> Saved</span>
                  )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                          Monthly Goals
                      </label>
                      <textarea 
                          className="w-full h-24 bg-surfaceHighlight/30 border border-border/50 rounded-lg p-3 resize-none focus:outline-none focus:border-primary/50 text-sm text-textMain placeholder:text-textMuted/40 transition-colors scrollbar-thin"
                          placeholder="List your key objectives for this month..."
                          value={noteData.goals}
                          onChange={(e) => handleNoteChange('goals', e.target.value)}
                          spellCheck={false}
                      />
                  </div>

                  <div className="space-y-1.5 flex flex-col flex-1 min-h-[250px]">
                      <label className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                          Trade Notes
                      </label>
                      <textarea 
                          className="w-full flex-1 bg-surfaceHighlight/30 border border-border/50 rounded-lg p-3 resize-none focus:outline-none focus:border-primary/50 text-sm text-textMain placeholder:text-textMuted/40 transition-colors scrollbar-thin leading-relaxed"
                          placeholder="General trading notes, strategy adjustments, lessons learned, and market observations..."
                          value={noteData.notes}
                          onChange={(e) => handleNoteChange('notes', e.target.value)}
                          spellCheck={false}
                      />
                  </div>

                  <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                          Month Review
                      </label>
                      <textarea 
                          className="w-full h-32 bg-surfaceHighlight/30 border border-border/50 rounded-lg p-3 resize-none focus:outline-none focus:border-primary/50 text-sm text-textMain placeholder:text-textMuted/40 transition-colors scrollbar-thin"
                          placeholder="What went well? What needs improvement? Final verdict on performance..."
                          value={noteData.review}
                          onChange={(e) => handleNoteChange('review', e.target.value)}
                          spellCheck={false}
                      />
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default CalendarView;
