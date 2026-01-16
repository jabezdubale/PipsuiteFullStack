
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TagGroup, Session, TradeOutcome, ASSETS, TradeStatus, TradeType } from '../types';
import { X, Check, Calculator, Clock, Upload, Clipboard, Image as ImageIcon, Info, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Slash } from 'lucide-react';
import { getSessionForTime } from '../utils/sessionHelpers';
import { calculateAutoTags } from '../utils/autoTagLogic';

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
    fees: currentData.fees ? currentData.fees.toString() : '0', // Manual Fees
    deltaFromPland: currentData.deltaFromPland ? currentData.deltaFromPland.toString() : '0', // Calculated Gap
    exitPrice: currentData.exitPrice || '',
    entryPrice: currentData.entryPrice || '',
    
    // Dates - Default to empty if not provided in currentData
    entryDate: currentData.entryDate,
    entryTime: currentData.entryTime || '',
    exitDate: currentData.exitDate || '', 
    exitTime: currentData.exitTime || '',
    exitSession: currentData.exitSession || Session.NONE,

    // Journals
    notes: currentData.notes || '',
    emotionalNotes: currentData.emotionalNotes || '',
    tags: currentData.tags || [],
    screenshots: currentData.screenshots || []
  });

  const [expandedTagGroup, setExpandedTagGroup] = useState<string | null>(null);
  const [affectBalance, setAffectBalance] = useState(true);
  
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
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64 = event.target?.result as string;
              if (base64) {
                 setFormData(prev => ({
                    ...prev,
                    screenshots: [...prev.screenshots, base64]
                 }));
              }
            };
            reader.readAsDataURL(blob);
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
    return main + partialsTotal;
  }, [formData.mainPnl, partialsTotal]);

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

  // Delta from Plan Calculation (Replaces old 'Fees' calc)
  useEffect(() => {
      if (formData.mainPnl === '') return; // Don't auto-calc if empty
      
      if (plannedReward > 0) {
          const calcDelta = plannedReward - netPnl;
          setFormData(prev => ({ ...prev, deltaFromPland: calcDelta.toFixed(2) }));
      }
  }, [netPnl, plannedReward, formData.mainPnl]);

  // --- Helpers ---
  const getInputValue = (isoString: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Image too large (Max 2MB)");
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
            ...prev,
            screenshots: [...prev.screenshots, reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddImageFromUrl = () => {
      if (newImageUrl) {
          setFormData(prev => ({
              ...prev,
              screenshots: [...prev.screenshots, newImageUrl]
          }));
          setNewImageUrl('');
      }
  };

  const handleRemoveImage = (index: number) => {
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
                  const blob = await item.getType(imageType);
                  const reader = new FileReader();
                  reader.onloadend = () => {
                      const base64 = reader.result as string;
                      setFormData(prev => ({
                        ...prev,
                        screenshots: [...prev.screenshots, base64]
                      }));
                  };
                  reader.readAsDataURL(blob);
                  return;
              }
          }
          alert("No image found in clipboard.");
      } catch (err) {
          console.error("Clipboard access failed:", err);
          alert("Unable to access clipboard directly. Please use Ctrl+V.");
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
        affectBalance // Pass the checkbox state back
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
                                            Target: <span className="text-profit font-mono font-medium">${plannedReward.toFixed(2)}</span>
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

                            {/* Fees Inputs */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-textMuted mb-1.5 flex justify-between">
                                        <span>Fees / Swap</span>
                                        <span className="text-[10px] opacity-60">Manual</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted">$</span>
                                        <input 
                                            type="number" 
                                            step="any"
                                            value={formData.fees}
                                            onChange={(e) => setFormData({...formData, fees: e.target.value})}
                                            className="w-full bg-surface border border-border rounded-lg pl-7 pr-3 py-2 text-sm text-loss font-medium focus:outline-none focus:ring-1 focus:ring-loss"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-textMuted mb-1.5 flex justify-between">
                                        <span>Plan Delta</span>
                                        <span className="text-[10px] opacity-60">Calc</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted">$</span>
                                        <input 
                                            type="number" 
                                            step="any"
                                            value={formData.deltaFromPland}
                                            readOnly
                                            className="w-full bg-surfaceHighlight/30 border border-border/40 rounded-lg pl-7 pr-3 py-2 text-sm text-textMain focus:outline-none cursor-default"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exit Date & Time */}
                    <div>
                        <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                           <Clock size={14} /> Exit Time
                        </h4>
                        <div className="bg-surfaceHighlight/20 rounded-lg p-4 space-y-4 border border-border/40">
                             <div className="grid grid-cols-2 gap-4">
                                 <div>
                                     <label className="block text-xs font-medium text-textMuted mb-1.5">Exit Price</label>
                                     <div className="flex gap-2">
                                         <input 
                                             type="number" 
                                             step="any"
                                             value={formData.exitPrice}
                                             onChange={(e) => setFormData({...formData, exitPrice: e.target.value})}
                                             className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                             placeholder="-"
                                         />
                                         {/* Buttons to quick fill TP/SL/Entry */}
                                         <div className="flex flex-col gap-0.5">
                                             <button type="button" onClick={() => handleFillPrice('TP')} className="text-[9px] bg-surfaceHighlight px-1.5 rounded hover:text-profit" title="Fill TP">TP</button>
                                             <button type="button" onClick={() => handleFillPrice('SL')} className="text-[9px] bg-surfaceHighlight px-1.5 rounded hover:text-loss" title="Fill SL">SL</button>
                                             <button type="button" onClick={() => handleFillPrice('EN')} className="text-[9px] bg-surfaceHighlight px-1.5 rounded" title="Fill Entry">EN</button>
                                         </div>
                                     </div>
                                 </div>
                                 <div>
                                      <label className="block text-xs font-medium text-textMuted mb-1.5">Exit Date/Time</label>
                                      <input 
                                          type="datetime-local"
                                          value={getInputValue(formData.exitDate)}
                                          onChange={(e) => handleDateTimeChange('exit', e.target.value)}
                                          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                                      />
                                 </div>
                             </div>
                             
                             <div className="flex items-center gap-4">
                                 <div className="flex-1">
                                     <label className="block text-xs font-medium text-textMuted mb-1.5">Session</label>
                                     <input 
                                          type="text"
                                          value={formData.exitSession}
                                          readOnly
                                          className="w-full bg-surfaceHighlight/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-textMuted cursor-default"
                                     />
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: Journal & Media */}
                <div className="space-y-6">
                    {/* Tags */}
                    <div>
                        <label className="text-xs font-bold text-textMain uppercase tracking-wider mb-2 block">Tags</label>
                        <div className="bg-surfaceHighlight/20 rounded-lg p-4 border border-border/40 space-y-3">
                             {/* Active Tags */}
                             <div className="flex flex-wrap gap-2">
                                  {formData.tags.map(tag => (
                                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-primary/10 text-primary border border-primary/20">
                                          {tag}
                                          <button onClick={() => toggleTag(tag)} className="hover:text-primary"><X size={10}/></button>
                                      </span>
                                  ))}
                                  {formData.tags.length === 0 && <span className="text-xs text-textMuted italic">No tags selected</span>}
                             </div>

                             {/* Tag Groups */}
                             <div className="border border-border/40 rounded-md divide-y divide-border/40 max-h-[200px] overflow-y-auto">
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

                    {/* Notes */}
                    <div>
                         <label className="text-xs font-bold text-textMain uppercase tracking-wider mb-2 block">Notes</label>
                         <div className="space-y-3">
                             <textarea 
                                  value={formData.notes}
                                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                  className="w-full bg-surface border border-border rounded-lg p-3 text-sm text-textMain focus:outline-none focus:border-primary min-h-[80px] resize-none"
                                  placeholder="Technical Notes / Closing Thoughts..."
                             />
                             <textarea 
                                  value={formData.emotionalNotes}
                                  onChange={(e) => setFormData({...formData, emotionalNotes: e.target.value})}
                                  className="w-full bg-surface border border-border rounded-lg p-3 text-sm text-textMain focus:outline-none focus:border-primary min-h-[60px] resize-none"
                                  placeholder="Emotional State at Close..."
                             />
                         </div>
                    </div>

                    {/* Screenshots */}
                    <div>
                         <label className="text-xs font-bold text-textMain uppercase tracking-wider mb-2 flex justify-between items-center">
                             Screenshots
                             <div className="flex items-center gap-2">
                                <button type="button" onClick={handlePasteClick} className="text-[10px] text-textMuted hover:text-textMain flex items-center gap-1" title="Paste"><Clipboard size={10}/> Paste</button>
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] text-primary hover:underline flex items-center gap-1"><Upload size={10}/> Upload</button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                             </div>
                         </label>
                         
                         <div className="grid grid-cols-4 gap-2 mb-2">
                             {formData.screenshots.map((url: string, idx: number) => (
                                 <div key={idx} className="aspect-square bg-surface border border-border rounded overflow-hidden relative group">
                                     <img src={url} className="w-full h-full object-cover" />
                                     <button onClick={() => handleRemoveImage(idx)} className="absolute top-0.5 right-0.5 bg-black/50 text-white p-0.5 rounded opacity-0 group-hover:opacity-100"><X size={10}/></button>
                                 </div>
                             ))}
                             {formData.screenshots.length === 0 && (
                                 <div className="col-span-4 p-4 border border-dashed border-border rounded-lg text-center text-xs text-textMuted italic">No screenshots</div>
                             )}
                         </div>
                         
                         <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={newImageUrl} 
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className="flex-1 bg-surface border border-border rounded px-2 py-1 text-xs text-textMain focus:outline-none focus:border-primary"
                                placeholder="Image URL..."
                             />
                             <button type="button" onClick={handleAddImageFromUrl} className="px-2 py-1 bg-primary text-white rounded text-xs">Add</button>
                         </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-5 border-t border-border bg-surface flex justify-between items-center">
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={affectBalance} 
                    onChange={(e) => setAffectBalance(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm text-textMain font-medium">Update Account Balance</span>
                <div className="group relative">
                    <Info size={14} className="text-textMuted cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-black/90 text-white text-[10px] p-2 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
                        If checked, the P&L will be credited/debited to your account balance.
                    </div>
                </div>
            </label>

            <div className="flex gap-3">
                <button onClick={onClose} className="px-5 py-2 text-sm font-medium text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded-lg transition-colors">
                    Cancel
                </button>
                <button 
                    onClick={handleConfirm}
                    className="px-6 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                >
                    <Check size={16} /> Confirm Close
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CloseTradeModal;
