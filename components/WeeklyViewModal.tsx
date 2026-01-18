
import React, { useState, useEffect } from 'react';
import { Trade, TradeType, TradeStatus, TradeOutcome } from '../types';
import { X, ArrowRight, GripVertical, TrendingUp, TrendingDown, Slash, Activity, MousePointer2, CheckSquare, Trash2, Download, Check } from 'lucide-react';

interface WeeklyViewModalProps {
  startDate: string;
  endDate: string;
  trades: Trade[];
  onClose: () => void;
  onTradeClick: (trade: Trade) => void;
  onTrashTrades: (ids: string[]) => void;
  onExportTrades: (trades: Trade[]) => void;
  deleteResultStatus?: 'idle' | 'confirmed' | 'cancelled';
  deleteResultNonce?: number;
}

type ColumnKey = 'symbol' | 'type' | 'quantity' | 'rr' | 'outcome' | 'pnl';

const WeeklyViewModal: React.FC<WeeklyViewModalProps> = ({ startDate, endDate, trades, onClose, onTradeClick, onTrashTrades, onExportTrades, deleteResultStatus, deleteResultNonce }) => {
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

  // Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
      if (!isSelectionMode) setSelectedIds(new Set());
  }, [isSelectionMode]);

  // Effect to handle delete confirmation from App
  useEffect(() => {
      if (deleteResultStatus === 'confirmed') {
          setSelectedIds(new Set());
          setIsSelectionMode(false);
      }
  }, [deleteResultNonce, deleteResultStatus]);

  const toggleSelectAll = () => {
      if (selectedIds.size === trades.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(trades.map(t => t.id)));
      }
  };

  const handleRowClick = (trade: Trade) => {
      if (isSelectionMode) {
          const newSelected = new Set(selectedIds);
          if (newSelected.has(trade.id)) newSelected.delete(trade.id);
          else newSelected.add(trade.id);
          setSelectedIds(newSelected);
      } else {
          onTradeClick(trade);
      }
  };

  const handleBulkDelete = () => {
      if (selectedIds.size === 0) return;
      onTrashTrades(Array.from(selectedIds));
      // Do not clear selection immediately; wait for confirmation via props
  };

  const handleBulkExport = () => {
      if (selectedIds.size === 0) return;
      const selectedTrades = trades.filter(t => selectedIds.has(t.id));
      onExportTrades(selectedTrades);
  };

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
          
          {/* Actions */}
          <div className="flex items-center gap-2">
              {isSelectionMode ? (
                  <div className="flex items-center gap-2 bg-surfaceHighlight p-1 rounded-lg border border-primary/30 animate-in fade-in slide-in-from-right-2">
                      <button 
                        onClick={toggleSelectAll}
                        className="px-3 py-1.5 text-xs font-medium text-textMain hover:bg-surface rounded transition-colors flex items-center gap-1.5"
                      >
                          <CheckSquare size={14} /> All
                      </button>
                      <div className="h-4 w-px bg-border/50"></div>
                      <button 
                          onClick={handleBulkDelete}
                          disabled={selectedIds.size === 0}
                          className="px-3 py-1.5 text-xs font-medium text-loss hover:bg-loss/10 rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                          <Trash2 size={14} /> Delete
                      </button>
                      <button 
                          onClick={handleBulkExport}
                          disabled={selectedIds.size === 0}
                          className="px-3 py-1.5 text-xs font-medium text-textMain hover:bg-surface rounded transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                          <Download size={14} /> Export
                      </button>
                      <div className="h-4 w-px bg-border/50"></div>
                      <button 
                          onClick={() => setIsSelectionMode(false)}
                          className="p-1.5 text-textMuted hover:text-textMain hover:bg-surface rounded transition-colors"
                          title="Exit Selection"
                      >
                          <X size={14} />
                      </button>
                  </div>
              ) : (
                  <>
                    <button 
                        onClick={() => setIsSelectionMode(true)}
                        className="bg-surface border border-border px-3 py-2 rounded-lg text-textMuted hover:text-primary flex items-center gap-2 text-xs transition-colors"
                        title="Select Trades"
                    >
                        <MousePointer2 size={14} /> Select
                    </button>
                    <button onClick={onClose} className="p-2 bg-surface border border-border rounded-lg hover:bg-surfaceHighlight transition-colors text-textMuted hover:text-textMain">
                        <X size={18} />
                    </button>
                  </>
              )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto p-0 flex-1">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-surfaceHighlight text-textMuted border-b border-border sticky top-0 z-10">
              <tr>
                {isSelectionMode && (
                    <th className="sticky left-0 top-0 z-50 w-[40px] px-4 py-3 bg-surfaceHighlight border-r border-border/50 text-center">
                        <CheckSquare size={14} />
                    </th>
                )}
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
              {trades.map((trade) => {
                const isSelected = selectedIds.has(trade.id);
                return (
                    <tr 
                    key={trade.id} 
                    onClick={() => handleRowClick(trade)}
                    className={`transition-colors cursor-pointer group ${isSelected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-surfaceHighlight/50'}`}
                    >
                    {isSelectionMode && (
                        <td className={`sticky left-0 z-30 px-4 py-3 border-r border-border/50 text-center transition-colors ${isSelected ? 'bg-primary/10 group-hover:bg-primary/20' : 'bg-surface group-hover:bg-surfaceHighlight'}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center mx-auto transition-colors ${isSelected ? 'bg-primary border-primary text-white' : 'border-textMuted/50 bg-background'}`}>
                                {isSelected && <Check size={10} strokeWidth={4} />}
                            </div>
                        </td>
                    )}
                    {columns.map(col => (
                        <td key={col} className="p-4">
                            {renderCell(trade, col)}
                        </td>
                    ))}
                    <td className="p-4 text-center">
                        {!isSelectionMode && (
                            <button className="text-primary hover:text-textMain transition-colors opacity-0 group-hover:opacity-100">
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </td>
                    </tr>
                );
              })}
              {trades.length === 0 && (
                <tr>
                  <td colSpan={columns.length + (isSelectionMode ? 2 : 1)} className="p-8 text-center text-textMuted">No trades recorded for this week.</td>
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
