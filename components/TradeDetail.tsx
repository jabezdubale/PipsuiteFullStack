import React, { useState, useEffect, useRef } from 'react';
import { Trade, Account, TagGroup, TradeStatus, TradeType, ASSETS, TradeOutcome } from '../types';
import { ArrowLeft, Save, Trash2, Clock, Image as ImageIcon, Upload, Loader2, X } from 'lucide-react';
import { toLocalInputString } from '../utils/dateUtils';
import { compressImage, addScreenshot } from '../utils/imageUtils';
import { uploadImage } from '../services/storageService';

interface TradeDetailProps {
  trade: Trade;
  onSave: (trade: Trade, shouldClose?: boolean, balanceChange?: number) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  accounts: Account[];
  tagGroups: TagGroup[];
  strategies: string[];
  onUpdateBalance: (amount: number, type: 'deposit' | 'withdraw') => void;
}

const TradeDetail: React.FC<TradeDetailProps> = ({ trade, onSave, onDelete, onBack, accounts, tagGroups, strategies, onUpdateBalance }) => {
  // State for form data
  const [formData, setFormData] = useState<Trade>(trade);
  
  // Refs for auto-save logic to prevent stale closures and ensure flush on unmount/back
  const formDataRef = useRef<Trade>(trade);
  const financialsRef = useRef<{balanceChange: number}>({ balanceChange: 0 }); // Track balance impact if any
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualSave = useRef(false);

  // Sync state with prop if trade changes (e.g. initial load or external update)
  useEffect(() => {
    setFormData(trade);
    formDataRef.current = trade;
  }, [trade.id]);

  // Cleanup timeout on unmount
  useEffect(() => {
      return () => {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      };
  }, []);

  const performSave = (data: Trade, financials: { balanceChange: number } = { balanceChange: 0 }) => {
      onSave(data, false, financials.balanceChange);
  };

  // Helper to update form data and trigger auto-save debounce
  const updateField = (updates: Partial<Trade>) => {
      const newData = { ...formData, ...updates };
      setFormData(newData);
      formDataRef.current = newData;
      
      // Debounce save (2 seconds)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
          if (!isManualSave.current) {
              performSave(newData); 
          }
      }, 2000);
  };

  // Safe manual back to list (ensures flush of any pending changes)
  const handleBack = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      isManualSave.current = true;
      performSave(formDataRef.current, financialsRef.current);
      onBack();
  };

  const handleDelete = () => {
      if (window.confirm('Are you sure you want to delete this trade?')) {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          onDelete(trade.id);
          onBack(); 
      }
  };

  const handleManualSave = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      isManualSave.current = true;
      performSave(formDataRef.current, financialsRef.current);
      // Optional: Visual feedback or close
      alert("Trade Saved!");
      isManualSave.current = false; // Reset for future edits if we stay on page
  };

  // Image handling
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              setIsUploading(true);
              const base64 = await compressImage(file);
              const url = await uploadImage(file.name, base64);
              const newScreenshots = addScreenshot(formData.screenshots, url);
              updateField({ screenshots: newScreenshots });
          } catch (e: any) {
              alert(e.message);
          } finally {
              setIsUploading(false);
          }
      }
  };

  const handleRemoveImage = (index: number) => {
      const newScreenshots = formData.screenshots.filter((_, i) => i !== index);
      updateField({ screenshots: newScreenshots });
  };

  const toggleTag = (tag: string) => {
      const currentTags = formData.tags || [];
      const newTags = currentTags.includes(tag) 
        ? currentTags.filter(t => t !== tag) 
        : [...currentTags, tag];
      updateField({ tags: newTags });
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 hover:bg-surfaceHighlight rounded-full text-textMuted hover:text-textMain transition-colors">
                <ArrowLeft size={20} />
            </button>
            <div>
                <h2 className="text-lg font-bold text-textMain flex items-center gap-2">
                    {formData.symbol} 
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${formData.type === TradeType.LONG ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {formData.type}
                    </span>
                </h2>
                <p className="text-xs text-textMuted">Editing Trade Details</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleDelete} className="p-2 text-loss hover:bg-loss/10 rounded-lg transition-colors" title="Delete Trade">
                <Trash2 size={20} />
            </button>
            <button onClick={handleManualSave} className="px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg transition-colors flex items-center gap-2">
                <Save size={16} /> Save
            </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Stats & Setup */}
            <div className="space-y-6 lg:col-span-2">
                
                {/* 1. Execution */}
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Clock size={16} /> Execution Details
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Asset Pair</label>
                                <select 
                                    value={formData.symbol} 
                                    onChange={(e) => updateField({ symbol: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                >
                                    {ASSETS.map(a => <option key={a.id} value={a.assetPair}>{a.assetPair}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Direction</label>
                                <select 
                                    value={formData.type} 
                                    onChange={(e) => updateField({ type: e.target.value as TradeType })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                >
                                    {Object.values(TradeType).map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Status</label>
                                <select 
                                    value={formData.status} 
                                    onChange={(e) => updateField({ status: e.target.value as TradeStatus })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                >
                                    {Object.values(TradeStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Outcome</label>
                                <select 
                                    value={formData.outcome} 
                                    onChange={(e) => updateField({ outcome: e.target.value as TradeOutcome })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                >
                                    {Object.values(TradeOutcome).map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Entry Date & Time</label>
                                <input 
                                    type="datetime-local" 
                                    value={toLocalInputString(formData.entryDate)} 
                                    onChange={(e) => updateField({ entryDate: new Date(e.target.value).toISOString() })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Entry Price</label>
                                <input 
                                    type="number" step="any"
                                    value={formData.entryPrice} 
                                    onChange={(e) => updateField({ entryPrice: parseFloat(e.target.value) })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Exit Date & Time</label>
                                <input 
                                    type="datetime-local" 
                                    value={toLocalInputString(formData.exitDate)} 
                                    onChange={(e) => updateField({ exitDate: new Date(e.target.value).toISOString() })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1">Exit Price</label>
                                <input 
                                    type="number" step="any"
                                    value={formData.exitPrice || ''} 
                                    onChange={(e) => updateField({ exitPrice: parseFloat(e.target.value) })}
                                    className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Financials */}
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        Financials & Risk
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Quantity (Lots)</label>
                             <input 
                                type="number" step="any"
                                value={formData.quantity} 
                                onChange={(e) => updateField({ quantity: parseFloat(e.target.value) })}
                                className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Net P&L ($)</label>
                             <input 
                                type="number" step="any"
                                value={formData.pnl} 
                                onChange={(e) => updateField({ pnl: parseFloat(e.target.value) })}
                                className={`w-full bg-background border rounded-lg p-2.5 text-sm font-bold focus:ring-1 outline-none ${formData.pnl >= 0 ? 'text-profit border-profit/30 focus:ring-profit' : 'text-loss border-loss/30 focus:ring-loss'}`}
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Fees ($)</label>
                             <input 
                                type="number" step="any"
                                value={formData.fees} 
                                onChange={(e) => updateField({ fees: parseFloat(e.target.value) })}
                                className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                             />
                        </div>
                         <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Risk (%)</label>
                             <input 
                                type="number" step="any"
                                value={formData.riskPercentage || ''} 
                                onChange={(e) => updateField({ riskPercentage: parseFloat(e.target.value) })}
                                className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                             />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                         <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Stop Loss</label>
                             <input 
                                type="number" step="any"
                                value={formData.stopLoss || ''} 
                                onChange={(e) => updateField({ stopLoss: parseFloat(e.target.value) })}
                                className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Take Profit</label>
                             <input 
                                type="number" step="any"
                                value={formData.takeProfit || ''} 
                                onChange={(e) => updateField({ takeProfit: parseFloat(e.target.value) })}
                                className="w-full bg-background border border-border rounded-lg p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                             />
                        </div>
                    </div>
                </div>

                {/* 3. Screenshots */}
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ImageIcon size={16} /> Screenshots
                    </h3>
                    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                        {formData.screenshots.map((url, idx) => (
                            <div key={idx} className="relative group aspect-square bg-black/50 rounded-lg overflow-hidden border border-border">
                                <img src={url} alt={`Screenshot ${idx}`} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => handleRemoveImage(idx)}
                                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        <div className="aspect-square bg-surfaceHighlight/30 border border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-surfaceHighlight/50 transition-colors">
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="flex flex-col items-center gap-1 text-textMuted hover:text-textMain"
                            >
                                {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                                <span className="text-[10px] uppercase font-bold">Upload</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Column: Journal & Tags */}
            <div className="space-y-6">
                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm h-full flex flex-col">
                    <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-4">Journal</h3>
                    <div className="space-y-4 flex-1">
                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Technical Notes</label>
                             <textarea 
                                value={formData.notes}
                                onChange={(e) => updateField({ notes: e.target.value })}
                                className="w-full h-40 bg-surfaceHighlight/20 border border-border rounded-lg p-3 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none resize-none"
                                placeholder="Strategy, Setup details..."
                             />
                        </div>
                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-1">Emotional Notes</label>
                             <textarea 
                                value={formData.emotionalNotes}
                                onChange={(e) => updateField({ emotionalNotes: e.target.value })}
                                className="w-full h-32 bg-surfaceHighlight/20 border border-border rounded-lg p-3 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none resize-none"
                                placeholder="How did you feel?"
                             />
                        </div>
                        
                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-2">Strategy / Setup</label>
                             <div className="flex flex-wrap gap-2">
                                 {strategies.map(strat => (
                                     <button
                                        key={strat}
                                        onClick={() => updateField({ setup: strat })}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                            formData.setup === strat 
                                            ? 'bg-primary text-white border-primary' 
                                            : 'bg-background border-border text-textMuted hover:border-primary/50'
                                        }`}
                                     >
                                         {strat}
                                     </button>
                                 ))}
                             </div>
                        </div>

                        <div>
                             <label className="block text-xs font-medium text-textMuted mb-2">Tags</label>
                             <div className="flex flex-wrap gap-2 mb-4 bg-background p-2 rounded-lg border border-border/50 min-h-[40px]">
                                 {formData.tags.map(tag => (
                                     <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                                         {tag}
                                         <button onClick={() => toggleTag(tag)} className="hover:text-red-500"><X size={10}/></button>
                                     </span>
                                 ))}
                                 {formData.tags.length === 0 && <span className="text-xs text-textMuted italic p-1">No tags selected</span>}
                             </div>
                             
                             <div className="space-y-2 border-t border-border pt-4 max-h-[400px] overflow-y-auto pr-1">
                                 {tagGroups.map(group => (
                                     <div key={group.name} className="bg-surfaceHighlight/10 rounded-lg p-2">
                                         <p className="text-[10px] font-bold text-textMuted uppercase mb-2">{group.name}</p>
                                         <div className="flex flex-wrap gap-1.5">
                                             {group.tags.map(tag => (
                                                 <button
                                                    key={tag}
                                                    onClick={() => toggleTag(tag)}
                                                    className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                                                        formData.tags.includes(tag) 
                                                        ? 'bg-primary/20 border-primary text-primary opacity-50' 
                                                        : 'bg-background border-border text-textMuted hover:border-textMain'
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
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default TradeDetail;