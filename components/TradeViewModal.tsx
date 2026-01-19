
import React, { useState } from 'react';
import { Trade, TradeStatus, TradeType, Account, ASSETS, TradeOutcome, TagGroup, TradePartial } from '../types';
import { X, Calendar, Clock, ArrowRight, Edit2, Trash2, Tag, Image as ImageIcon, TrendingUp, TrendingDown, DollarSign, Activity, Layers, Hash, Slash, CheckCircle } from 'lucide-react';
import CloseTradeModal from './CloseTradeModal';
import PlannedMoney from './PlannedMoney';
import { getBaseQuote } from '../utils/symbol';

interface TradeViewModalProps {
  trade: Trade;
  account?: Account;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: (trade: Trade, shouldClose?: boolean, balanceChange?: number) => void;
  tagGroups: TagGroup[];
  onUpdateBalance: (amount: number, type: 'deposit' | 'withdraw') => void;
}

const DetailRow = ({ label, value, subValue, className = '' }: { label: string, value: React.ReactNode, subValue?: string, className?: string }) => (
  <div className={`flex justify-between items-start py-2 border-b border-border/40 last:border-0 ${className}`}>
    <span className="text-textMuted text-xs uppercase tracking-wide font-medium mt-0.5">{label}</span>
    <div className="text-right">
        <div className="text-sm font-medium text-textMain">{value}</div>
        {subValue && <div className="text-[10px] text-textMuted">{subValue}</div>}
    </div>
  </div>
);

const TradeViewModal: React.FC<TradeViewModalProps> = ({ trade, account, onClose, onEdit, onDelete, onSave, tagGroups, onUpdateBalance }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);

  const formatDisplayDate = (isoString: string | undefined) => {
      if (!isoString) return '-';
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '-';

      // Get local time components
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      
      // 12-Hour Time Format
      let hours = date.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const h = hours.toString().padStart(2, '0');
      
      const min = date.getMinutes().toString().padStart(2, '0');
      const s = date.getSeconds().toString().padStart(2, '0');

      // Calculate Offset
      const offsetMinutes = date.getTimezoneOffset();
      const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
      const offsetMinsRemainder = Math.abs(offsetMinutes % 60);
      const sign = offsetMinutes > 0 ? '-' : '+'; // Inverted sign for display convention

      let offsetString = `UTC${sign}${offsetHours}`;
      if (offsetMinsRemainder > 0) {
        offsetString += `:${offsetMinsRemainder.toString().padStart(2, '0')}`;
      }
      
      return `${d}/${m}/${y}, ${h}:${min}:${s} ${ampm} ${offsetString}`;
  };

  const getPips = (targetPrice: number | undefined) => {
    if (!targetPrice || !trade.entryPrice) return null;
    const asset = ASSETS.find(a => a.assetPair === trade.symbol);
    if (!asset) return null;
    const diff = Math.abs(targetPrice - trade.entryPrice);
    return (diff / asset.pip).toFixed(1);
  };

  const slPips = getPips(trade.stopLoss);
  const tpPips = getPips(trade.takeProfit);

  const isWin = trade.pnl > 0;
  const isLoss = trade.pnl < 0;

  // Calculate Planned RR
  let rr = 0;
  if (trade.entryPrice && trade.stopLoss && trade.takeProfit) {
      const risk = Math.abs(trade.entryPrice - trade.stopLoss);
      const reward = Math.abs(trade.takeProfit - trade.entryPrice);
      if (risk > 0) {
          rr = reward / risk;
      }
  }

  // Calculate Planned Reward
  let plannedReward = 0;
  const asset = ASSETS.find(a => a.assetPair === trade.symbol);
  if (asset && trade.entryPrice && trade.takeProfit && trade.quantity) {
      const dist = Math.abs(trade.takeProfit - trade.entryPrice);
      plannedReward = dist * asset.contractSize * trade.quantity;
  }
  
  const quoteInfo = getBaseQuote(trade.symbol);
  const quoteCurrency = quoteInfo ? quoteInfo.quote : 'USD';

  const handleCloseModalConfirm = (closedData: any) => {
      // 1. Prepare updated trade data based on closing details
      const updatedTradeData = {
          ...trade,
          ...closedData,
          outcome: TradeOutcome.CLOSED
      };
      
      const affectBalance = closedData.affectBalance;
      delete updatedTradeData.affectBalance;

      // 2. Calculate final stats
      const main = parseFloat(updatedTradeData.mainPnl) || 0;
      const fees = parseFloat(updatedTradeData.fees) || 0;
      const partialsTotal = (updatedTradeData.partials || []).reduce((acc: number, p: TradePartial) => acc + (p.pnl || 0), 0);
      const net = main + partialsTotal - fees;
      
      let status = TradeStatus.BREAK_EVEN;
      if (net > 0) status = TradeStatus.WIN;
      else if (net < 0) status = TradeStatus.LOSS;

      // 3. Update Balance if requested
      // We set the trade property to true if balance was affected
      updatedTradeData.isBalanceUpdated = !!affectBalance;

      const finalTrade = {
        ...updatedTradeData,
        pnl: net,
        status,
        entryPrice: parseFloat(updatedTradeData.entryPrice),
        exitPrice: parseFloat(updatedTradeData.exitPrice),
        quantity: parseFloat(updatedTradeData.quantity),
        fees: fees,
        mainPnl: parseFloat(updatedTradeData.mainPnl)
      };

      // Calculate DELTA for balance update to support re-editing
      // If it was already updated, we subtract the old PnL (revert) and add the new PnL (apply)
      // Or simply: New Effect - Old Effect
      const oldBalanceEffect = trade.isBalanceUpdated ? (trade.pnl || 0) : 0;
      const newBalanceEffect = affectBalance ? net : 0;
      const balanceChange = newBalanceEffect - oldBalanceEffect;

      // 4. Save and close internal modal
      onSave(finalTrade, false, balanceChange);
      setIsCloseModalOpen(false);
  };

  // Logic to show close button:
  // 1. Explicitly marked as OPEN outcome
  // 2. OR outcome is missing (legacy data) AND status is OPEN
  const showCloseButton = trade.outcome === TradeOutcome.OPEN || (!trade.outcome && trade.status === TradeStatus.OPEN);

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-surface border border-border rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-border bg-surfaceHighlight/10">
            <div className="flex items-center gap-3">
                <div className={`px-2.5 py-1 rounded-md text-sm font-bold border ${
                    trade.type === TradeType.LONG 
                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                    : 'bg-red-500/10 text-red-500 border-red-500/20'
                }`}>
                    {trade.type}
                </div>
                <h2 className="text-xl font-bold text-textMain">{trade.symbol}</h2>
                <span className="text-textMuted text-sm border-l border-border pl-3 ml-1">
                    {formatDisplayDate(trade.entryDate).split(',')[0]}
                </span>
            </div>
            <div className="flex gap-2">
                {showCloseButton && (
                    <button 
                        onClick={() => setIsCloseModalOpen(true)}
                        className="px-3 py-1.5 bg-primary hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-primary/20 flex items-center gap-1.5"
                    >
                        <CheckCircle size={14} /> Close Trade
                    </button>
                )}
                <button 
                    onClick={onClose} 
                    className="p-2 text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded-lg transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-0">
            
            {/* Hero Stats */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border bg-surfaceHighlight/5">
                <div className="p-6 text-center">
                    <span className="text-xs text-textMuted uppercase block mb-1">Net P&L</span>
                    <span className={`text-2xl font-bold ${isWin ? 'text-profit' : isLoss ? 'text-loss' : 'text-textMain'}`}>
                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </span>
                </div>
                <div className="p-6 text-center">
                    <span className="text-xs text-textMuted uppercase block mb-1">Status</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                        trade.status === TradeStatus.WIN ? 'bg-profit/10 text-profit' :
                        trade.status === TradeStatus.LOSS ? 'bg-loss/10 text-loss' :
                        trade.status === TradeStatus.MISSED ? 'bg-gray-500/10 text-gray-400' :
                        'bg-gray-500/10 text-gray-400'
                    }`}>
                        {trade.status === TradeStatus.WIN ? <TrendingUp size={12}/> : 
                         trade.status === TradeStatus.LOSS ? <TrendingDown size={12}/> : 
                         trade.status === TradeStatus.MISSED ? <Slash size={12}/> : <Activity size={12}/>}
                        {trade.status}
                    </span>
                </div>
                <div className="p-6 text-center">
                    <span className="text-xs text-textMuted uppercase block mb-1">RR (Risk/Reward)</span>
                    <span className="text-xl font-bold text-textMain">
                        {rr > 0 ? `1:${rr.toFixed(2)}` : '-'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2">
                {/* Left Column: Details */}
                <div className="p-6 space-y-6 border-r border-border">
                    
                    {/* Execution Details */}
                    <div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Activity size={14} /> Execution
                        </h4>
                        <div className="bg-surfaceHighlight/20 rounded-lg p-4 space-y-1">
                            <DetailRow label="Account" value={account?.name || '-'} />
                            <DetailRow label="Lot Size" value={trade.quantity} />
                            
                            {/* Entry Details */}
                            <div className="py-2 border-b border-border/40">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-textMuted text-xs uppercase tracking-wide font-medium">Entry</span>
                                    <span className="text-sm font-medium text-textMain">{trade.entryPrice}</span>
                                </div>
                                <div className="flex flex-col gap-1 text-[10px] text-textMuted">
                                    <span className="flex items-center gap-1">
                                        <Clock size={10} /> {formatDisplayDate(trade.entryDate)}
                                    </span>
                                    <span>Session: {trade.entrySession || '-'}</span>
                                </div>
                            </div>

                            {/* Exit Details */}
                            <div className="py-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-textMuted text-xs uppercase tracking-wide font-medium">Exit</span>
                                    <span className="text-sm font-medium text-textMain">{trade.exitPrice || '-'}</span>
                                </div>
                                <div className="flex flex-col gap-1 text-[10px] text-textMuted">
                                    <span className="flex items-center gap-1">
                                        <Clock size={10} /> {trade.exitDate ? formatDisplayDate(trade.exitDate) : '-'}
                                    </span>
                                    <span>Session: {trade.exitSession || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Setup & Risk */}
                    <div>
                         <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                            <DollarSign size={14} /> Setup & Risk
                        </h4>
                        <div className="bg-surfaceHighlight/20 rounded-lg p-4 space-y-1">
                            <DetailRow label="Strategy" value={trade.setup || '-'} />
                            <DetailRow label="Risk %" value={trade.riskPercentage ? `${trade.riskPercentage}%` : '-'} />
                            <DetailRow 
                                label="Stop Loss" 
                                value={trade.stopLoss || '-'} 
                                subValue={slPips ? `${slPips} pips` : undefined}
                            />
                            <DetailRow 
                                label="Take Profit" 
                                value={trade.takeProfit || '-'} 
                                subValue={tpPips ? `${tpPips} pips` : undefined}
                            />
                            <DetailRow 
                                label="Planned Reward" 
                                value={plannedReward > 0 ? (
                                    <PlannedMoney quoteAmount={plannedReward} quoteCurrency={quoteCurrency} />
                                ) : '-'} 
                            />
                            <DetailRow label="Fees" value={`$${trade.fees.toFixed(2)}`} />
                        </div>
                    </div>

                    {/* Partials */}
                    {trade.partials && trade.partials.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Layers size={14} /> Partials
                            </h4>
                            <div className="bg-surfaceHighlight/20 rounded-lg overflow-hidden border border-border/40">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-surfaceHighlight/50 text-textMuted border-b border-border/40">
                                        <tr>
                                            <th className="p-2 font-medium">Lot</th>
                                            <th className="p-2 font-medium">Price</th>
                                            <th className="p-2 font-medium text-right">PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {trade.partials.map((p, i) => (
                                            <tr key={i} className="text-textMain">
                                                <td className="p-2">{p.quantity}</td>
                                                <td className="p-2">{p.price || '-'}</td>
                                                <td className="p-2 text-right font-medium text-profit">${p.pnl.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Notes & Media */}
                <div className="p-6 space-y-6">
                    {/* Tags */}
                    {trade.tags && trade.tags.length > 0 && (
                        <div>
                             <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Tag size={12} /> Tags
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {trade.tags.map(tag => (
                                    <span key={tag} className="px-2 py-1 bg-surfaceHighlight border border-border rounded text-[10px] text-textMuted">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                         <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Journal</h4>
                         <div className="space-y-4">
                            <div className="bg-surfaceHighlight/30 p-4 rounded-lg border border-border/50">
                                <span className="text-[10px] text-textMuted uppercase font-bold block mb-2">Technical Notes</span>
                                <p className="text-sm text-textMain whitespace-pre-wrap leading-relaxed">
                                    {trade.notes || <span className="text-textMuted italic">No technical notes recorded.</span>}
                                </p>
                            </div>

                            {trade.emotionalNotes && (
                                <div className="bg-surfaceHighlight/30 p-4 rounded-lg border border-border/50">
                                    <span className="text-[10px] text-textMuted uppercase font-bold block mb-2">Emotional State</span>
                                    <p className="text-sm text-textMain whitespace-pre-wrap leading-relaxed">
                                        {trade.emotionalNotes}
                                    </p>
                                </div>
                            )}
                         </div>
                    </div>

                    {/* Media */}
                    <div>
                         <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                             <ImageIcon size={14} /> Screenshots
                         </h4>
                         {trade.screenshots && trade.screenshots.length > 0 ? (
                             <div className="grid grid-cols-2 gap-3">
                                 {trade.screenshots.map((url, idx) => (
                                     <div 
                                        key={idx} 
                                        className="aspect-video bg-black/50 rounded-lg overflow-hidden border border-border cursor-pointer hover:border-primary transition-colors relative group"
                                        onClick={() => setSelectedImage(url)}
                                     >
                                         <img src={url} alt="Trade" className="w-full h-full object-cover" />
                                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                     </div>
                                 ))}
                             </div>
                         ) : (
                             <div className="text-xs text-textMuted italic p-4 border border-dashed border-border rounded-lg text-center">
                                 No screenshots attached.
                             </div>
                         )}
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface flex justify-between items-center">
            <button 
                onClick={onDelete}
                className="px-4 py-2 text-xs font-medium text-loss hover:bg-loss/10 rounded-lg transition-colors flex items-center gap-2"
            >
                <Trash2 size={14} /> Delete Trade
            </button>
             <button 
                onClick={onEdit} 
                className="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-primary/20 flex items-center gap-2"
            >
                Edit Trade <ArrowRight size={16} />
            </button>
        </div>
      </div>

      {/* Close Trade Modal */}
      {isCloseModalOpen && (
          <CloseTradeModal 
            currentData={trade}
            tagGroups={tagGroups}
            onClose={() => setIsCloseModalOpen(false)}
            onConfirm={handleCloseModalConfirm}
          />
      )}

      {/* Image Zoom Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[210] p-4 animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedImage(null);
          }}
        >
          <div className="relative max-w-full max-h-full">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2"
            >
              <X size={24} />
            </button>
            <img src={selectedImage} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeViewModal;
