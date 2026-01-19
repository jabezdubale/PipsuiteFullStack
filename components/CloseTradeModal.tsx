
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TagGroup, Session, TradeOutcome, ASSETS, TradeStatus, TradeType } from '../types';
import { X, Check, Calculator, Clock, Upload, Clipboard, Trash2, Image as ImageIcon, Info, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Slash, Loader2 } from 'lucide-react';
import { getSessionForTime } from '../utils/sessionHelpers';
import { calculateAutoTags } from '../utils/autoTagLogic';
import { toLocalInputString } from '../utils/dateUtils';
import { compressImage, addScreenshot } from '../utils/imageUtils';
import { uploadImage, deleteBlobImages } from '../services/storageService';
import { getBaseQuote } from '../utils/symbol';
import PlannedMoney from './PlannedMoney';

interface CloseTradeModalProps {
  currentData: any; // The current form data from TradeDetail
  tagGroups: TagGroup[];
  onConfirm: (data: any) => void;
  onClose: () => void;
}

const CloseTradeModal: React.FC<CloseTradeModalProps> = ({ currentData, tagGroups, onConfirm, onClose }) => {
  // Initialize state with current form data, defaulting exit values if not present
  const [formData, setFormData] = useState({
    mainPnl: currentData.mainPnl || '',
    fees: currentData.fees ? currentData.fees.toString() : '0',
    exitPrice: currentData.exitPrice || '',
    entryPrice: currentData.entryPrice || '',
    
    // Dates - Default to empty if not provided in currentData
    entryDate: currentData.entryDate,
    entryTime: currentData.entryTime || '',
    exitDate: currentData.exitDate || '', 
    exitTime: currentData.exitTime || '',
    exitSession: currentData.exitSession || Session.NONE,

    // Final SL/TP
    finalStopLoss: currentData.finalStopLoss ? currentData.finalStopLoss.toString() : '',
    finalTakeProfit: currentData.finalTakeProfit ? currentData.finalTakeProfit.toString() : '',

    // Journals
    notes: currentData.notes || '',
    emotionalNotes: currentData.emotionalNotes || '',
    tags: currentData.tags || [],
    screenshots: currentData.screenshots || []
  });

  const [expandedTagGroup, setExpandedTagGroup] = useState<string | null>(null);
  const [affectBalance, setAffectBalance] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // New Result State
  const [result, setResult] = useState<TradeStatus>(TradeStatus.BREAK_EVEN);
  
  const [newImageUrl, setNewImageUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Auto-Determine Result Logic ---
  useEffect(() => {
      const entry = parseFloat(formData.entryPrice);
      const exit = parseFloat(formData.exitPrice);
      
      if (!isNaN(entry) && !isNaN(exit)) {
          if (currentData.type === TradeType.LONG) {
              if (exit > entry) setResult(TradeStatus.WIN);
              else if (exit < entry) setResult(TradeStatus.LOSS);
              else setResult(TradeStatus.BREAK_EVEN);
          } else { // SHORT
              if (exit < entry) setResult(TradeStatus.WIN);
              else if (exit > entry) setResult(TradeStatus.LOSS);
              else setResult(TradeStatus.BREAK_EVEN);
          }
      }
  }, [formData.exitPrice, formData.entryPrice, currentData.type]);

  // --- Auto-Sign Logic for Core P&L (Triggered on Result Change) ---
  useEffect(() => {
      if (!formData.mainPnl) return;
      const val = parseFloat(formData.mainPnl);
      if (isNaN(val)) return;

      if (result === TradeStatus.LOSS || result === TradeStatus.BREAK_EVEN) {
          // Default to negative when switching to LOSS or BREAK_EVEN
          if (val > 0) {
              setFormData(prev => ({ ...prev, mainPnl: (-val).toString() }));
          }
      } else if (result === TradeStatus.WIN) {
          // Default to positive when switching to WIN
          if (val < 0) {
              setFormData(prev => ({ ...prev, mainPnl: Math.abs(val).toString() }));
          }
      }
  }, [result]); 

  // --- Input Change Handler (Free Text) ---
  const handlePnlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData(prev => ({ ...prev, mainPnl: e.target.value }));
  };

  // --- Validate/Sign on Blur ---
  const handlePnlBlur = () => {
      const val = formData.mainPnl;
      if (val === '' || val === '-') return;

      const num = parseFloat(val);
      if (isNaN(num)) return;

      if (result === TradeStatus.WIN) {
          setFormData(prev => ({ ...prev, mainPnl: Math.abs(num).toString() }));
      } else if (result === TradeStatus.LOSS) {
          setFormData(prev => ({ ...prev, mainPnl: (-Math.abs(num)).toString() }));
      }
  };

  // --- Paste Listener for Images ---
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          e.preventDefault(); // Stop default browser paste behavior
          const blob = items[i].getAsFile();
          if (blob) {
             try {
                 setIsUploading(true);
                 const base64 = await compressImage(blob);
                 const uniqueName = `pasted_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
                 const url = await uploadImage(uniqueName, base64);
                 setFormData(prev => {
                    try {
                      return { ...prev, screenshots: addScreenshot(prev.screenshots || [], url) };
                    } catch (e: any) {
                      alert(e?.message || 'Unable to add screenshot.');
                      return prev;
                    }
                 });
             } catch(e) {
                 console.error(e);
                 alert("Failed to upload image");
             } finally {
                 setIsUploading(false);
             }
             return; // Stop processing after first image
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

  // --- Calculations ---
  const partialsTotal = (currentData.partials || []).reduce((acc: number, p: any) => acc + (p.pnl || 0), 0);
  
  const netPnl = useMemo(() => {
    const main = parseFloat(formData.mainPnl) || 0;
    const fees = parseFloat(formData.fees) || 0;
    return main + partialsTotal - fees;
  }, [formData.mainPnl, formData.fees, partialsTotal]);

  const plannedReward = useMemo(() => {
      const asset = ASSETS.find(a => a.assetPair === currentData.symbol);
      const entry = parseFloat(currentData.entryPrice);
      const tp = parseFloat(currentData.takeProfit);
      const qty = parseFloat(currentData.quantity);
      
      if (asset && !isNaN(entry) && !isNaN(tp) && !isNaN(qty)) {
          const dist = Math.abs(tp - entry);
          return dist * asset.contractSize * qty;
      }
      return 0;
  }, [currentData]);
  
  const quoteCurrency = useMemo(() => {
      const info = getBaseQuote(currentData.symbol);
      return info ? info.quote : 'USD';
  }, [currentData.symbol]);

  // --- Helpers ---
  const handleDateTimeChange = (field: 'entry' | 'exit', value: string) => {
      if (!value) {
          // If cleared, just update the date/time fields to empty
          setFormData(prev => ({
              ...prev,
              [`${field}Date`]: '',
              [`${field}Time`]: '',
              [`${field}Session`]: Session.NONE
          }));
          return;
      }

      const date = new Date(value);
      if (!isNaN(date.getTime())) {
          const iso = date.toISOString();
          const hours = date.getHours().toString().padStart(2, '0');
          const mins = date.getMinutes().toString().padStart(2, '0');
          const time = `${hours}:${mins}`;
          
          const updates: any = {
             [`${field}Date`]: iso,
             [`${field}Time`]: time,
          };

          // Calculate Session for the changed field
          updates[`${field}Session`] = getSessionForTime(date);

          setFormData(prev => ({ ...prev, ...updates }));
      }
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => {
      const currentTags = prev.tags || [];
      if (currentTags.includes(tag)) {
        return { ...prev, tags: currentTags.filter((t: string) => t !== tag) };
      } else {
        return { ...prev, tags: [...currentTags, tag] };
      }
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
          setIsUploading(true);
          const base64 = await compressImage(file);
          const url = await uploadImage(file.name, base64);
          setFormData(prev => {
            try {
              return { ...prev, screenshots: addScreenshot(prev.screenshots || [], url) };
            } catch (e: any) {
              alert(e?.message || 'Unable to add screenshot.');
              return prev;
            }
          });
      } catch (e) {
          console.error(e);
          alert("Image processing failed.");
      } finally {
          setIsUploading(false);
      }
    }
  };

  const handleAddImageFromUrl = () => {
      if (newImageUrl) {
          setFormData(prev => {
              try {
                return { ...prev, screenshots: addScreenshot(prev.screenshots || [], newImageUrl) };
              } catch (e: any) {
                alert(e?.message || 'Unable to add screenshot.');
                return prev;
              }
          });
          setNewImageUrl('');
      }
  };

  const handleRemoveImage = async (index: number) => {
      const urlToRemove = formData.screenshots[index];
      if (urlToRemove) {
          try {
              await deleteBlobImages([urlToRemove]);
          } catch (e) {
              console.error("Failed to delete blob:", e);
          }
      }
      setFormData(prev => ({
          ...prev,
          screenshots: prev.screenshots.filter((_: any, i: number) => i !== index)
      }));
  };

  const handlePasteClick = async () => {
      try {
          const items = await navigator.clipboard.read();
          for (const item of items) {
              const imageType = item.types.find(type => type.startsWith('image/'));
              if (imageType) {
                  setIsUploading(true);
                  const blob = await item.getType(imageType);
                  const base64 = await compressImage(blob);
                  const uniqueName = `pasted_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
                  const url = await uploadImage(uniqueName, base64);
                  setFormData(prev => {
                    try {
                      return { ...prev, screenshots: addScreenshot(prev.screenshots || [], url) };
                    } catch (e: any) {
                      alert(e?.message || 'Unable to add screenshot.');
                      return prev;
                    }
                  });
                  return;
              }
          }
          alert("No image found in clipboard.");
      } catch (err) {
          console.error("Clipboard access failed:", err);
          alert("Unable to access clipboard directly. Please use Ctrl+V.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleFillPrice = (type: 'TP' | 'SL' | 'EN') => {
      let price;
      if (type === 'TP') price = currentData.takeProfit;
      else if (type === 'SL') price = currentData.stopLoss;
      else if (type === 'EN') price = currentData.entryPrice;

      if (price !== undefined && price !== null) {
          setFormData(prev => ({ ...prev, exitPrice: price.toString() }));
      }
  };

  const handleConfirm = () => {
    const finalExitDate = formData.exitDate || new Date().toISOString();
    let finalExitSession = formData.exitSession;
    if ((!formData.exitDate || formData.exitSession === Session.NONE) && finalExitDate) {
        finalExitSession = getSessionForTime(new Date(finalExitDate));
    }

    // --- APPLY AUTOMATIC TAGS BEFORE CLOSING ---
    const updatedTags = calculateAutoTags({
        tags: formData.tags,
        type: currentData.type,
        entryPrice: parseFloat(formData.entryPrice),
        exitPrice: parseFloat(formData.exitPrice),
        takeProfit: currentData.takeProfit ? parseFloat(currentData.takeProfit) : undefined,
        stopLoss: currentData.stopLoss ? parseFloat(currentData.stopLoss) : undefined,
        partials: currentData.partials
    });

    onConfirm({
        ...formData,
        tags: updatedTags,
        exitDate: finalExitDate,
        exitSession: finalExitSession,
        outcome: TradeOutcome.CLOSED,
        affectBalance, // Pass the checkbox state back
        // Explicitly convert Final SL/TP to numbers for DB persistence
        finalStopLoss: formData.finalStopLoss ? parseFloat(formData.finalStopLoss) : undefined,
        finalTakeProfit: formData.finalTakeProfit ? parseFloat(formData.finalTakeProfit) : undefined,
        fees: parseFloat(formData.fees) || 0
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
          e.stopPropagation();
          onClose();
      }}
    >
      <div 
        className="bg-surface border border-border rounded-xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex justify-between items-center bg-surfaceHighlight/10">
          <h3 className="text-xl font-bold text-textMain">Close Trade</h3>
          <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* LEFT: Financials & Time */}
                <div className="space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                           <Calculator size={14} /> Financial Results
                        </h4>
                        
                        <div className="bg-surfaceHighlight/20 rounded-lg p-4 space-y-4 border border-border/40">
                             
                             {/* Result Selector */}
                             <div className="grid grid-cols-3 gap-2">
                                <button 
                                    onClick={() => setResult(TradeStatus.WIN)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                                        result === TradeStatus.WIN 
                                        ? 'bg-profit/20 border-profit text-profit' 
                                        : 'bg-surface border-border text-textMuted hover:border-profit/50'
                                    }`}
                                >
                                    <TrendingUp size={14} /> Win
                                </button>
                                <button 
                                    onClick={() => setResult(TradeStatus.LOSS)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                                        result === TradeStatus.LOSS 
                                        ? 'bg-loss/20 border-loss text-loss' 
                                        : 'bg-surface border-border text-textMuted hover:border-loss/50'
                                    }`}
                                >
                                    <TrendingDown size={14} /> Loss
                                </button>
                                <button 
                                    onClick={() => setResult(TradeStatus.BREAK_EVEN)}
                                    className={`py-2 rounded-lg text-xs font-bold border transition-colors flex items-center justify-center gap-1 ${
                                        result === TradeStatus.BREAK_EVEN 
                                        ? 'bg-gray-500/20 border-gray-500 text-gray-400' 
                                        : 'bg-surface border-border text-textMuted hover:border-gray-500/50'
                                    }`}
                                >
                                    <Slash size={14} /> Break-Even
                                </button>
                             </div>

                             {/* Core P&L */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="block text-xs font-bold text-textMain">Core P&L</label>
                                    {plannedReward > 0 && (
                                        <span className="text-[10px] text-textMuted bg-surfaceHighlight/50 px-1.5 py-0.5 rounded border border-border/30">
                                            Target: <PlannedMoney quoteAmount={plannedReward} quoteCurrency={quoteCurrency} showUsdOnly={true} className="text-profit font-mono font-medium" />
                                        </span>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted">$</span>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={formData.mainPnl}
                                        onChange={handlePnlChange}
                                        onBlur={handlePnlBlur}
                                        className={`w-full bg-surface border rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:ring-1 outline-none ${
                                            result === TradeStatus.WIN ? 'text-profit border-profit/30 focus:ring-profit' : 
                                            result === TradeStatus.LOSS ? 'text-loss border-loss/30 focus:ring-loss' : 
                                            'text-textMain border-border focus:ring-primary'
                                        }`}
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-textMuted mb-1.5">Partials (Sum)</label>
                                    <div className="w-full bg-surfaceHighlight/50 border border-border/40 rounded-lg px-3 py-2 text-sm text-textMain font-mono opacity-70">
                                        ${partialsTotal.toFixed(2)}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-textMain mb-1.5">Net P&L (Total)</label>
                                    <div className={`w-full bg-surfaceHighlight/50 border border-border/40 rounded-lg px-3 py-2 text-sm font-bold font-mono ${netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                        ${netPnl.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Fees Input */}
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1.5 flex justify-between">
                                    <span>Fees / Commission</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted">$</span>
                                    <input 
                                        type="number" 
                                        step="any"
                                        value={formData.fees}
                                        onChange={(e) => setFormData({...formData, fees: e.target.value})}
                                        className="w-full bg-surface border border-border/40 rounded-lg pl-7 pr-3 py-2 text-sm font-bold text-textMain focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                         <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                           <Clock size={14} /> Price & Time
                        </h4>
                        
                        <div className="bg-surfaceHighlight/20 rounded-lg p-4 space-y-4 border border-border/40">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-textMuted mb-1.5">Entry Price</label>
                                    <div className="w-full bg-surfaceHighlight/50 border border-border/40 rounded-lg px-3 py-2 text-sm text-textMain font-mono opacity-70">
                                        {formData.entryPrice}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-xs font-medium text-textMain">Exit Price</label>
                                        <div className="flex gap-1.5">
                                            <button 
                                                type="button"
                                                onClick={() => handleFillPrice('EN')}
                                                className="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-[10px] font-bold transition-colors"
                                                title={`Use Entry: ${currentData.entryPrice}`}
                                            >
                                                EN
                                            </button>
                                            {currentData.takeProfit && (
                                                <button 
                                                    type="button"
                                                    onClick={() => handleFillPrice('TP')}
                                                    className="px-1.5 py-0.5 bg-profit/10 hover:bg-profit/20 text-profit border border-profit/20 rounded text-[10px] font-bold transition-colors"
                                                    title={`Use TP: ${currentData.takeProfit}`}
                                                >
                                                    TP
                                                </button>
                                            )}
                                            {currentData.stopLoss && (
                                                <button 
                                                    type="button"
                                                    onClick={() => handleFillPrice('SL')}
                                                    className="px-1.5 py-0.5 bg-loss/10 hover:bg-loss/20 text-loss border border-loss/20 rounded text-[10px] font-bold transition-colors"
                                                    title={`Use SL: ${currentData.stopLoss}`}
                                                >
                                                    SL
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <input 
                                        type="number"
                                        step="any"
                                        value={formData.exitPrice}
                                        onChange={(e) => setFormData({...formData, exitPrice: e.target.value})}
                                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-textMain font-mono focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-textMuted mb-1.5">Entry Time</label>
                                    <input 
                                        type="datetime-local" 
                                        value={toLocalInputString(formData.entryDate)} 
                                        onChange={(e) => handleDateTimeChange('entry', e.target.value)}
                                        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-textMain mb-1.5">Exit Time</label>
                                     <input 
                                        type="datetime-local" 
                                        value={toLocalInputString(formData.exitDate)} 
                                        onChange={(e) => handleDateTimeChange('exit', e.target.value)}
                                        className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>

                            {/* Final SL / TP Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-textMuted mb-1.5">Final SL</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="number" 
                                            step="any" 
                                            value={formData.finalStopLoss} 
                                            onChange={(e) => setFormData({...formData, finalStopLoss: e.target.value})} 
                                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary"
                                            placeholder="-"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setFormData(prev => ({...prev, finalStopLoss: currentData.stopLoss?.toString() || ''}))}
                                            className="px-2 py-1 bg-surfaceHighlight border border-border/60 hover:border-primary/50 text-[10px] text-textMuted hover:text-textMain rounded transition-colors"
                                            title={`Copy Entry SL: ${currentData.stopLoss || '-'}`}
                                        >
                                            same
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-textMuted mb-1.5">Final TP</label>
                                    <div className="flex gap-1.5">
                                        <input 
                                            type="number" 
                                            step="any" 
                                            value={formData.finalTakeProfit} 
                                            onChange={(e) => setFormData({...formData, finalTakeProfit: e.target.value})} 
                                            className="w-full bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary"
                                            placeholder="-"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setFormData(prev => ({...prev, finalTakeProfit: currentData.takeProfit?.toString() || ''}))}
                                            className="px-2 py-1 bg-surfaceHighlight border border-border/60 hover:border-primary/50 text-[10px] text-textMuted hover:text-textMain rounded transition-colors"
                                            title={`Copy Entry TP: ${currentData.takeProfit || '-'}`}
                                        >
                                            same
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Journaling & Media */}
                <div className="space-y-6">
                    <div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4">Journal</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1.5">Technical Notes</label>
                                <textarea 
                                    value={formData.notes}
                                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                    className="w-full bg-surface border border-border rounded-lg p-3 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none min-h-[100px] resize-none"
                                    placeholder="Final thoughts on the setup..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-textMuted mb-1.5">Emotional Notes</label>
                                <textarea 
                                    value={formData.emotionalNotes}
                                    onChange={(e) => setFormData({...formData, emotionalNotes: e.target.value})}
                                    className="w-full bg-surface border border-border rounded-lg p-3 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none min-h-[80px] resize-none"
                                    placeholder="How did you feel closing this?"
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Media Upload Section */}
                    <div>
                         <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                             <ImageIcon size={14} /> Evidence
                         </h4>
                         <div className="bg-surfaceHighlight/20 border border-border/40 rounded-lg p-3">
                             {/* Screenshots Grid */}
                             {formData.screenshots.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mb-3">
                                    {formData.screenshots.map((url, idx) => (
                                        <div key={idx} className="relative group aspect-square bg-black/50 rounded overflow-hidden border border-border">
                                            <img src={url} alt={`Screenshot ${idx}`} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => handleRemoveImage(idx)}
                                                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                             )}

                             {/* Actions */}
                             <div className="flex gap-2">
                                <div className="relative flex-1">
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
                                        className="w-full py-2 bg-surface hover:bg-surfaceHighlight border border-border/60 hover:border-primary/50 text-textMuted hover:text-textMain rounded text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                        {isUploading ? 'Uploading...' : 'Upload File'}
                                    </button>
                                </div>
                                <button 
                                    onClick={handlePasteClick}
                                    disabled={isUploading}
                                    className="flex-1 py-2 bg-surface hover:bg-surfaceHighlight border border-border/60 hover:border-primary/50 text-textMuted hover:text-textMain rounded text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Clipboard size={12} />}
                                    Paste Image
                                </button>
                             </div>
                             <p className="text-[10px] text-textMuted mt-2 text-center">
                                 Tip: You can also press <kbd className="font-mono bg-surfaceHighlight px-1 rounded border border-border">Ctrl+V</kbd> anywhere in this modal to paste.
                             </p>
                         </div>
                    </div>

                    {/* Tag Manager Replicated */}
                    <div>
                        <label className="text-xs font-bold text-textMain uppercase tracking-wider block mb-3">Tags</label>
                          <div className="space-y-2">
                             {/* Active Tags Display */}
                             <div className="flex flex-wrap gap-2 mb-4 min-h-[32px] p-2 bg-surfaceHighlight/20 rounded-lg border border-border/40">
                                  {formData.tags.map((tag: string) => (
                                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                                          {tag}
                                          <button onClick={() => toggleTag(tag)} className="hover:text-primary"><X size={10}/></button>
                                      </span>
                                  ))}
                                  {formData.tags.length === 0 && <span className="text-xs text-textMuted italic">No tags selected</span>}
                              </div>

                              {/* Groups Accordion */}
                              <div className="border border-border/40 rounded-md divide-y divide-border/40 max-h-[150px] overflow-y-auto">
                                  {tagGroups.map((group) => {
                                      const isExpanded = expandedTagGroup === group.name;
                                      return (
                                          <div key={group.name} className="bg-surface/30">
                                              <button 
                                                onClick={() => setExpandedTagGroup(isExpanded ? null : group.name)}
                                                className="w-full flex justify-between items-center p-2 text-xs font-medium text-textMain hover:bg-surfaceHighlight/30 transition-colors"
                                              >
                                                  {group.name}
                                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                              </button>
                                              
                                              {isExpanded && (
                                                  <div className="p-2 flex flex-wrap gap-2 bg-background/50">
                                                      {group.tags.map(tag => {
                                                          const isSelected = formData.tags.includes(tag);
                                                          return (
                                                              <button
                                                                key={tag}
                                                                onClick={() => toggleTag(tag)}
                                                                className={`px-2 py-1 rounded text-[10px] border transition-all ${
                                                                    isSelected 
                                                                    ? 'bg-primary text-white border-primary' 
                                                                    : 'bg-surface border-border/50 text-textMuted hover:border-primary/50'
                                                                }`}
                                                              >
                                                                  {tag}
                                                              </button>
                                                          )
                                                      })}
                                                  </div>
                                              )}
                                          </div>
                                      )
                                  })}
                              </div>
                          </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-border bg-surface flex justify-between items-center rounded-b-xl">
            <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                    type="checkbox" 
                    checked={affectBalance}
                    onChange={(e) => setAffectBalance(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-surfaceHighlight"
                />
                <span className="text-sm font-medium text-textMain group-hover:text-primary transition-colors">Affect Account Balance</span>
                <div className="group relative">
                    <Info size={14} className="text-textMuted hover:text-primary" />
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                        If checked, the Net P&L will be added/deducted from your account balance immediately.
                    </span>
                </div>
            </label>
            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleConfirm}
                    disabled={isUploading}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-lg shadow-primary/20 flex items-center gap-2 ${
                        isUploading 
                        ? 'bg-surfaceHighlight text-textMuted cursor-not-allowed' 
                        : 'bg-primary hover:bg-blue-600 text-white'
                    }`}
                >
                    {isUploading && <Loader2 size={16} className="animate-spin" />}
                    <Check size={16} /> Confirm Close
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CloseTradeModal;
