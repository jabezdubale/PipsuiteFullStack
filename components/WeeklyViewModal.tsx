
import React, { useState } from 'react';
import { Trade, TradeType, TradeStatus, TradeOutcome } from '../types';
import { X, ArrowRight, GripVertical, TrendingUp, TrendingDown, Slash, Activity } from 'lucide-react';

interface WeeklyViewModalProps {
  startDate: string;
  endDate: string;
  trades: Trade[];
  onClose: () => void;
  onTradeClick: (trade: Trade) => void;
}

type ColumnKey = 'symbol' | 'type' | 'quantity' | 'rr' | 'outcome' | 'pnl';

const WeeklyViewModal: React.FC<WeeklyViewModalProps> = ({ startDate, endDate, trades, onClose, onTradeClick }) => {
  // Calculate weekly stats
  const weeklyPnL = trades.reduce((acc, t) => acc + t.pnl, 0);
  const winRate = trades.length > 0 
    ? (trades.filter(t => t.status === TradeStatus.WIN).length / trades.length) * 100 
    : 0;

  const start = new Date(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const end = new Date(endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Column State for Drag & Drop
  const [columns, setColumns] = useState<ColumnKey[]>(['symbol', 'type', 'quantity', 'rr', 'outcome', 'pnl']);
  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);

  const COLUMN_LABELS: Record<ColumnKey, string> = {
    symbol: 'Asset Pair',
    type: 'Direction',
    quantity: 'Lot Size',
    rr: 'RR Ratio',
    outcome: 'Outcome',
    pnl: 'Net P&L'
  };

  // --- Drag Handlers ---
  const handleDragStart = (e: React.DragEvent, col: ColumnKey) => {
    setDraggedColumn(col);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, targetCol: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetCol) return;

    const oldIndex = columns.indexOf(draggedColumn);
    const newIndex = columns.indexOf(targetCol);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newCols = [...columns];
      newCols.splice(oldIndex, 1);
      newCols.splice(newIndex, 0, draggedColumn);
      setColumns(newCols);
    }
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // --- Cell Renderer ---
  const renderCell = (trade: Trade, key: ColumnKey) => {
    switch (key) {
      case 'symbol':
        return <span className="font-bold text-textMain">{trade.symbol}</span>;
      
      case 'type':
        return (
           <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              trade.type === TradeType.LONG ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
            }`}>
              {trade.type}
            </span>
        );

      case 'quantity':
        return <span className="font-mono text-textMuted">{trade.quantity}</span>;

      case 'rr':
        if (!trade.entryPrice || !trade.stopLoss || !trade.takeProfit) return <span className="text-textMuted">-</span>;
        const risk = Math.abs(trade.entryPrice - trade.stopLoss);
        const reward = Math.abs(trade.takeProfit - trade.entryPrice);
        if (risk === 0) return <span className="text-textMuted">-</span>;
        return <span className="font-mono">1:{(reward / risk).toFixed(2)}</span>;

      case 'outcome':
         if (trade.outcome === TradeOutcome.CLOSED) {
             let statusColor = 'text-textMuted bg-gray-500/10 border-gray-500/20';
             let Icon = Activity;
             
             if (trade.status === TradeStatus.WIN) { 
                 statusColor = 'text-profit bg-profit/10 border-profit/20'; 
                 Icon = TrendingUp; 
             } else if (trade.status === TradeStatus.LOSS) { 
                 statusColor = 'text-loss bg-loss/10 border-loss/20'; 
                 Icon = TrendingDown; 
             } else if (trade.status === TradeStatus.BREAK_EVEN) { 
                 statusColor = 'text-textMuted bg-gray-500/10 border-gray-500/20'; 
                 Icon = Slash; 
             }

             return (
                 <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`}>
                    <Icon size={10} /> {trade.status}
                 </span>
             );
         }
         return <span className="text-textMuted text-xs italic">{trade.outcome}</span>;

      case 'pnl':
        return (
          <span className={`font-bold ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
          </span>
        );
      
      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-surface border border-border rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-surfaceHighlight/30">
          <div>
            <h2 className="text-xl font-bold text-textMain">
              Week: {start} – {end}
            </h2>
            <div className="flex gap-4 mt-2 text-sm">
              <span className={weeklyPnL >= 0 ? 'text-profit font-bold' : 'text-loss font-bold'}>
                Net P&L: ${weeklyPnL.toFixed(2)}
              </span>
              <span className="text-textMuted">Trades: {trades.length}</span>
              <span className="text-textMuted">Win Rate: {winRate.toFixed(0)}%</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-surface border border-border rounded-full hover:bg-surfaceHighlight transition-colors text-textMuted hover:text-textMain">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto p-0 flex-1">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-surfaceHighlight text-textMuted border-b border-border sticky top-0 z-10">
              <tr>
                {columns.map(col => (
                    <th 
                        key={col} 
                        className={`p-4 font-medium text-xs uppercase tracking-wider cursor-move select-none hover:bg-surfaceHighlight/80 transition-colors ${draggedColumn === col ? 'opacity-50' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, col)}
                        onDragOver={handleDragOver}
                        onDragEnter={(e) => handleDragEnter(e, col)}
                        onDragEnd={handleDragEnd}
                    >
                        <div className="flex items-center gap-2">
                            <GripVertical size={12} className="text-textMuted/50" />
                            {COLUMN_LABELS[col]}
                        </div>
                    </th>
                ))}
                <th className="p-4 w-[60px] text-center"></th> {/* Action Column */}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trades.map((trade) => (
                <tr 
                  key={trade.id} 
                  onClick={() => onTradeClick(trade)}
                  className="hover:bg-surfaceHighlight/50 transition-colors cursor-pointer group"
                >
                  {columns.map(col => (
                      <td key={col} className="p-4">
                          {renderCell(trade, col)}
                      </td>
                  ))}
                  <td className="p-4 text-center">
                    <button className="text-primary hover:text-textMain transition-colors opacity-0 group-hover:opacity-100">
                      <ArrowRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {trades.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-textMuted">No trades recorded for this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WeeklyViewModal;
