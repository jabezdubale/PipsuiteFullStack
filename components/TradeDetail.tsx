
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Trade, TradeType, TradeStatus, ASSETS, TradeOutcome, Session, OrderType, Account, TradePartial, TagGroup } from '../types';
import { ArrowLeft, Trash2, Plus, X, Upload, ChevronDown, ChevronUp, Clipboard } from 'lucide-react';
import { getSessionForTime } from '../utils/sessionHelpers';
import CloseTradeModal from './CloseTradeModal';
import { calculateAutoTags } from '../utils/autoTagLogic';

const SectionHeader = ({ title }: { title: string }) => (
  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{title}</h3>
);

const InputGroup = ({ label, children }: { label: string, children?: React.ReactNode }) => (
  <div className="space-y-1">
      <label className="text-[10px] uppercase text-textMuted font-medium">{label}</label>
      {children}
  </div>
);

const MinimalInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input 
      {...props}
      className={`w-full bg-transparent border border-border/40 rounded-md px-2 py-1.5 text-sm text-textMain focus:outline-none focus:border-primary transition-colors placeholder:text-textMuted/30 disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
  />
);

const MinimalSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative">
      <select 
          {...props}
          className={`w-full bg-transparent border border-border/40 rounded-md px-2 py-1.5 text-sm text-textMain focus:outline-none focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${props.className || ''}`}
          style={{backgroundColor: 'transparent'}}
      >
          {props.children}
      </select>
      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none"/>
  </div>
);

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean, title: string, message: string, onConfirm: () => void, onCancel: () => void }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-[1px] animate-in fade-in" onClick={onCancel}>
            <div className="bg-surface border border-border rounded-xl p-5 max-w-sm w-full shadow-2xl scale-100" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-2 text-textMain">{title}</h3>
                <p className="text-sm text-textMuted mb-6 leading-relaxed">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textMain hover:bg-surfaceHighlight rounded-lg transition-colors">No</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-blue-600 rounded-lg transition-colors shadow-lg shadow-primary/20">Yes</button>
                </div>
            </div>
        </div>
    );
};

interface TradeDetailProps {
  trade: Trade;
  accounts: Account[];
  tagGroups: TagGroup[];
  strategies: string[];
  onSave: (trade: Trade, shouldClose?: boolean) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  onUpdateBalance?: (amount: number, type: 'deposit' | 'withdraw') => void;
}

const TradeDetail: React.FC<TradeDetailProps> = ({ trade, accounts, tagGroups, strategies, onSave, onDelete, onBack, onUpdateBalance }) => {
  const [formData, setFormData] = useState<any>({
    ...trade,
    partials: trade.partials || [],
    outcome: trade.outcome || TradeOutcome.OPEN,
    orderType: trade.orderType || OrderType.MARKET,
    entrySession: trade.entrySession || Session.NONE,
    exitSession: trade.exitSession || Session.NONE,
    entryTime: trade.entryTime || '',
    exitTime: trade.exitTime || '',
    mainPnl: trade.mainPnl !== undefined ? trade.mainPnl : '', 
    entryPrice: trade.entryPrice.toString(),
    exitPrice: trade.exitPrice ? trade.exitPrice.toString() : '',
    quantity: trade.quantity.toString(),
    fees: trade.fees.toString(),
    takeProfit: trade.takeProfit ? trade.takeProfit.toString() : '',
    stopLoss: trade.stopLoss ? trade.stopLoss.toString() : '',
    setup: trade.setup || ''
  });

  const [newPartial, setNewPartial] = useState({ lot: '', price: '', pnl: '', dateTime: '' });
  const [expandedTagGroup, setExpandedTagGroup] = useState<string | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isMissedModalOpen, setIsMissedModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const account = accounts.find(a => a.id === formData.accountId);
  const isMissed = formData.outcome === TradeOutcome.MISSED;
  const isClosed = formData.outcome === TradeOutcome.CLOSED;
  const asset = ASSETS.find(a => a.assetPair === formData.symbol);

  const calculatedFinancials = useMemo(() => {
    const mainPnlStr = formData.mainPnl;
    const hasMainPnl = mainPnlStr !== '' && mainPnlStr !== null && !isNaN(parseFloat(mainPnlStr));
    const mainPnlVal = hasMainPnl ? parseFloat(mainPnlStr) : 0;
    
    const partialsTotal = (formData.partials || []).reduce((acc: number, p: TradePartial) => acc + (p.pnl || 0), 0);
    const hasPartials = formData.partials && formData.partials.length > 0;
    
    let netPnlDisplay: string | number = '-';
    let netPnlValue = 0; 

    if (hasMainPnl) {
        netPnlValue = mainPnlVal + partialsTotal;
        netPnlDisplay = netPnlValue;
    } else if (hasPartials) {
        netPnlValue = partialsTotal;
        netPnlDisplay = netPnlValue;
    } else {
        netPnlValue = 0;
        netPnlDisplay = '-';
    }

    let plannedReward = 0;
    let rr = 0;
    const tp = parseFloat(formData.takeProfit);
    const sl = parseFloat(formData.stopLoss);
    const entry = parseFloat(formData.entryPrice);
    const qty = parseFloat(formData.quantity);
    
    if (asset && !isNaN(entry)) {
         if (!isNaN(tp) && !isNaN(qty)) {
             const dist = Math.abs(tp - entry);
             plannedReward = dist * asset.contractSize * qty;
         }
         
         if (!isNaN(sl)) {
             const riskDist = Math.abs(entry - sl);
             const rewardDist = Math.abs(tp - entry);
             if (riskDist > 0) rr = rewardDist / riskDist;
         }
    }
    
    let feesDisplay: string | number = '-';
    let feesValue = 0;

    if (hasMainPnl) {
        feesValue = plannedReward - netPnlValue;
        feesDisplay = feesValue;
    }
    
    return {
        partialsTotal,
        netPnlValue,
        netPnlDisplay,
        feesValue,
        feesDisplay,
        plannedReward,
        rr
    };
  }, [formData, asset]);
  
  const getPips = (priceStr: string) => {
      if (!asset || !formData.entryPrice || !priceStr) return null;
      const entry = parseFloat(formData.entryPrice);
      const target = parseFloat(priceStr);
      if (isNaN(entry) || isNaN(target)) return null;
      return (Math.abs(target - entry) / asset.pip).toFixed(1);
  }
  
  const slPips = getPips(formData.stopLoss);
  const tpPips = getPips(formData.takeProfit);

  const performSave = (currentFormData: any, currentFinancials: any) => {
      const net = currentFinancials.netPnlValue;
      let status = TradeStatus.OPEN;
      
      if (currentFormData.outcome === TradeOutcome.MISSED) {
        status = TradeStatus.MISSED;
      } else if (currentFormData.outcome === TradeOutcome.CLOSED) {
          if (net > 0) status = TradeStatus.WIN;
          else if (net < 0) status = TradeStatus.LOSS;
          else status = TradeStatus.BREAK_EVEN;
      }

      const updatedTags = calculateAutoTags({
          tags: currentFormData.tags,
          type: currentFormData.type,
          entryPrice: parseFloat(currentFormData.entryPrice),
          exitPrice: currentFormData.exitPrice ? parseFloat(currentFormData.exitPrice) : undefined,
          takeProfit: currentFormData.takeProfit ? parseFloat(currentFormData.takeProfit) : undefined,
          stopLoss: currentFormData.stopLoss ? parseFloat(currentFormData.stopLoss) : undefined,
          partials: currentFormData.partials
      });

      const entryPrice = parseFloat(currentFormData.entryPrice) || 0;
      const exitPrice = parseFloat(currentFormData.exitPrice) || 0;
      const quantity = parseFloat(currentFormData.quantity) || 0;
      const fees = typeof currentFinancials.feesDisplay === 'number' ? currentFinancials.feesDisplay : 0;
      const takeProfit = parseFloat(currentFormData.takeProfit) || undefined;
      const stopLoss = parseFloat(currentFormData.stopLoss) || undefined;
      const mainPnl = currentFormData.mainPnl === '' ? undefined : parseFloat(currentFormData.mainPnl);

      const updatedTrade: Trade = {
          ...currentFormData,
          tags: updatedTags, 
          entryPrice,
          exitPrice: currentFormData.exitPrice ? exitPrice : undefined,
          quantity,
          fees,
          takeProfit,
          stopLoss,
          mainPnl,
          pnl: net,
          status,
          isBalanceUpdated: currentFormData.isBalanceUpdated
      };
      
      // Fix infinite loop: Compare tags before setting state
      const tagsChanged = JSON.stringify(updatedTags) !== JSON.stringify(currentFormData.tags);
      if (tagsChanged) {
          setFormData((prev: any) => ({ ...prev, tags: updatedTags }));
      }

      onSave(updatedTrade, false);
  };

  useEffect(() => {
      if (isFirstRender.current) {
          isFirstRender.current = false;
          return;
      }

      if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
          performSave(formData, calculatedFinancials);
      }, 1000);

      return () => {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      };
  }, [formData]); 

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              if (base64) {
                 setFormData((prev: any) => ({
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
                      setFormData((prev: any) => ({
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

  const handleRemoveImage = (index: number) => {
      setFormData((prev: any) => ({
          ...prev,
          screenshots: prev.screenshots.filter((_: any, i: number) => i !== index)
      }));
  };

  const handleChange = (field: string, value: any) => {
    if (field === 'outcome') {
        const newOutcome = value;
        const currentOutcome = formData.outcome;
        if (newOutcome === TradeOutcome.CLOSED) {
            setIsCloseModalOpen(true);
            return;
        } 
        if (currentOutcome === TradeOutcome.CLOSED && newOutcome === TradeOutcome.OPEN) {
            setIsReopenModalOpen(true);
            return;
        }
        if (newOutcome === TradeOutcome.MISSED) {
            setIsMissedModalOpen(true);
            return;
        }
    }
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleConfirmReopen = () => {
      if (formData.isBalanceUpdated && onUpdateBalance) {
          const previousPnl = formData.pnl;
          const type = previousPnl >= 0 ? 'withdraw' : 'deposit';
          onUpdateBalance(Math.abs(previousPnl), type);
      }

      const updatedForm = {
          ...formData,
          outcome: TradeOutcome.OPEN,
          isBalanceUpdated: false
      };
      
      setFormData(updatedForm);
      setIsReopenModalOpen(false);
      
      const tradeToSave: Trade = {
          ...updatedForm,
          entryPrice: parseFloat(updatedForm.entryPrice),
          exitPrice: updatedForm.exitPrice ? parseFloat(updatedForm.exitPrice) : undefined,
          quantity: parseFloat(updatedForm.quantity),
          fees: parseFloat(updatedForm.fees) || 0,
          takeProfit: updatedForm.takeProfit ? parseFloat(updatedForm.takeProfit) : undefined,
          stopLoss: updatedForm.stopLoss ? parseFloat(updatedForm.stopLoss) : undefined,
          mainPnl: updatedForm.mainPnl === '' ? undefined : parseFloat(updatedForm.mainPnl),
          pnl: calculatedFinancials.netPnlValue, 
          status: TradeStatus.OPEN
      };
      onSave(tradeToSave, false);
  };

  const handleConfirmMissed = () => {
      if (formData.outcome === TradeOutcome.CLOSED && formData.isBalanceUpdated && onUpdateBalance) {
          const previousPnl = formData.pnl;
          const type = previousPnl >= 0 ? 'withdraw' : 'deposit';
          onUpdateBalance(Math.abs(previousPnl), type);
      }

      const updatedForm = {
          ...formData,
          outcome: TradeOutcome.MISSED,
          mainPnl: '',
          partials: [],
          isBalanceUpdated: false
      };

      setFormData(updatedForm);
      setIsMissedModalOpen(false);

      const tradeToSave: Trade = {
          ...updatedForm,
          entryPrice: parseFloat(updatedForm.entryPrice),
          exitPrice: updatedForm.exitPrice ? parseFloat(updatedForm.exitPrice) : undefined,
          quantity: parseFloat(updatedForm.quantity),
          fees: parseFloat(updatedForm.fees) || 0,
          takeProfit: updatedForm.takeProfit ? parseFloat(updatedForm.takeProfit) : undefined,
          stopLoss: updatedForm.stopLoss ? parseFloat(updatedForm.stopLoss) : undefined,
          mainPnl: undefined,
          partials: [],
          pnl: 0,
          status: TradeStatus.MISSED
      };
      onSave(tradeToSave, false);
  };

  const handleCloseModalConfirm = (closedData: any) => {
      const updatedFormData = {
          ...formData,
          ...closedData,
          outcome: TradeOutcome.CLOSED
      };
      const affectBalance = closedData.affectBalance;
      delete updatedFormData.affectBalance;

      const main = parseFloat(updatedFormData.mainPnl) || 0;
      const partialsTotal = (updatedFormData.partials || []).reduce((acc: number, p: TradePartial) => acc + (p.pnl || 0), 0);
      const net = main + partialsTotal;
      
      let status = TradeStatus.BREAK_EVEN;
      if (net > 0) status = TradeStatus.WIN;
      else if (net < 0) status = TradeStatus.LOSS;

      updatedFormData.isBalanceUpdated = !!affectBalance;

      if (affectBalance && onUpdateBalance) {
          const type = net >= 0 ? 'deposit' : 'withdraw';
          onUpdateBalance(Math.abs(net), type);
      }

      updatedFormData.pnl = net;

      const updatedTags = calculateAutoTags({
          tags: updatedFormData.tags,
          type: updatedFormData.type,
          entryPrice: parseFloat(updatedFormData.entryPrice),
          exitPrice: parseFloat(updatedFormData.exitPrice),
          takeProfit: updatedFormData.takeProfit ? parseFloat(updatedFormData.takeProfit) : undefined,
          stopLoss: updatedFormData.stopLoss ? parseFloat(updatedFormData.stopLoss) : undefined,
          partials: updatedFormData.partials
      });
      updatedFormData.tags = updatedTags;

      const finalTradeToSave: Trade = {
        ...updatedFormData,
        entryPrice: parseFloat(updatedFormData.entryPrice),
        exitPrice: updatedFormData.exitPrice ? parseFloat(updatedFormData.exitPrice) : undefined,
        quantity: parseFloat(updatedFormData.quantity),
        fees: typeof calculatedFinancials.feesDisplay === 'number' ? calculatedFinancials.feesDisplay : 0, 
        takeProfit: updatedFormData.takeProfit ? parseFloat(updatedFormData.takeProfit) : undefined,
        stopLoss: updatedFormData.stopLoss ? parseFloat(updatedFormData.stopLoss) : undefined,
        mainPnl: updatedFormData.mainPnl === '' ? undefined : parseFloat(updatedFormData.mainPnl),
        pnl: net,
        status
      };

      setFormData(updatedFormData);
      onSave(finalTradeToSave, false);
      setIsCloseModalOpen(false);
  };

  const handleDateTimeChange = (field: 'entry' | 'exit', value: string) => {
      if (!value) {
          setFormData((prev: any) => ({
             ...prev,
             [`${field}Time`]: '', 
             [`${field}Session`]: Session.NONE,
             [`${field}Date`]: field === 'exit' ? undefined : prev[`${field}Date`]
          }));
          return;
      }

      const date = new Date(value);
      if (!isNaN(date.getTime())) {
          const iso = date.toISOString();
          const hours = date.getHours().toString().padStart(2, '0');
          const mins = date.getMinutes().toString().padStart(2, '0');
          const time = `${hours}:${mins}`;
          const session = getSessionForTime(date);

          setFormData((prev: any) => ({
             ...prev,
             [`${field}Date`]: iso,
             [`${field}Time`]: time,
             [`${field}Session`]: session
          }));
      }
  };

  const handleAddPartial = () => {
    if (!newPartial.lot || !newPartial.pnl) return;
    let isoDate = new Date().toISOString();
    if (newPartial.dateTime) {
        isoDate = new Date(newPartial.dateTime).toISOString();
    }
    const p: TradePartial = {
        id: Date.now().toString(),
        quantity: parseFloat(newPartial.lot),
        pnl: parseFloat(newPartial.pnl),
        price: newPartial.price ? parseFloat(newPartial.price) : undefined,
        date: isoDate
    };
    setFormData((prev: any) => ({ ...prev, partials: [...prev.partials, p] }));
    setNewPartial({ lot: '', price: '', pnl: '', dateTime: '' });
  };

  const handleRemovePartial = (id: string) => {
    setFormData((prev: any) => ({ ...prev, partials: prev.partials.filter((p: TradePartial) => p.id !== id) }));
  };

  const toggleTag = (tag: string) => {
      const currentTags = formData.tags || [];
      if (currentTags.includes(tag)) {
          handleChange('tags', currentTags.filter((t: string) => t !== tag));
      } else {
          handleChange('tags', [...currentTags, tag]);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("Image too large (Max 2MB)");
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev: any) => ({
            ...prev,
            screenshots: [...prev.screenshots, reader.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const formatDisplayDate = (isoString: string) => {
      if (!isoString) return '';
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      let hours = date.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; 
      const h = hours.toString().padStart(2, '0');
      const min = date.getMinutes().toString().padStart(2, '0');
      const s = date.getSeconds().toString().padStart(2, '0');
      const offsetMinutes = date.getTimezoneOffset();
      const offsetHours = Math.abs(Math.floor(offsetMinutes / 60));
      const offsetMinsRemainder = Math.abs(offsetMinutes % 60);
      const sign = offsetMinutes > 0 ? '-' : '+';
      let offsetString = `UTC${sign}${offsetHours}`;
      if (offsetMinsRemainder > 0) {
        offsetString += `:${offsetMinsRemainder.toString().padStart(2, '0')}`;
      }
      return `${d}/${m}/${y}, ${h}:${min}:${s} ${ampm} ${offsetString}`;
  };

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

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-300 font-sans -mt-4">
      <div className="flex items-center justify-between py-3 mb-6 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
         <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 hover:bg-surfaceHighlight rounded-full transition-colors text-textMuted hover:text-textMain"><ArrowLeft size={20} /></button>
             <div>
                 <h1 className="text-xl font-bold flex items-center gap-2">
                     <div className="relative group">
                        <select
                            value={formData.symbol}
                            onChange={(e) => handleChange('symbol', e.target.value)}
                            className="appearance-none bg-transparent hover:bg-surfaceHighlight/50 rounded cursor-pointer pr-1 focus:outline-none focus:ring-1 focus:ring-primary/50 text-textMain disabled:opacity-100 disabled:cursor-not-allowed"
                            title={isClosed || isMissed ? "Asset cannot be changed for closed/missed trades" : "Click to change asset"}
                            disabled={isClosed || isMissed}
                        >
                            {ASSETS.map(asset => (<option key={asset.id} value={asset.assetPair} className="bg-surface text-textMain">{asset.assetPair}</option>))}
                        </select>
                     </div>
                     <span className={`text-xs px-2 py-0.5 border rounded ${formData.type === TradeType.LONG ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-500'}`}>{formData.type}</span>
                 </h1>
                 <div className="flex items-center gap-2">
                    <span className="text-xs text-textMuted">{new Date(formData.entryDate).toLocaleDateString()}</span>
                    <span className="text-[10px] bg-surfaceHighlight px-1.5 rounded text-textMuted">Auto-saved</span>
                 </div>
             </div>
         </div>
         <div className="flex items-center gap-3">
             <button onClick={() => onDelete(trade.id)} className="px-4 py-2 text-xs font-medium text-loss hover:bg-loss/10 rounded transition-colors">Delete</button>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-8">
              <section>
                  <SectionHeader title="Trade Context" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                      <InputGroup label="Account">
                          <div className="h-[34px] flex items-center px-2 text-sm font-medium border border-border/40 rounded-md">
                             {account?.name || '-'} <span className="text-xs text-textMuted ml-2">({account?.type || (account?.isDemo ? 'Demo' : 'Real')})</span>
                          </div>
                      </InputGroup>
                      <InputGroup label="Status">
                          <div className={`h-[34px] flex items-center px-2 text-sm font-bold border border-border/40 rounded-md ${
                              formData.status === TradeStatus.WIN ? 'text-profit' : 
                              formData.status === TradeStatus.LOSS ? 'text-loss' : 'text-textMuted'
                          }`}>
                              {formData.status}
                          </div>
                      </InputGroup>
                      
                      <InputGroup label="Setup / Strategy">
                          <MinimalSelect value={formData.setup} onChange={(e) => handleChange('setup', e.target.value)}>
                              <option value="">Select Strategy...</option>
                              {strategies.map(s => <option key={s} value={s} className="bg-surface text-textMain">{s}</option>)}
                          </MinimalSelect>
                      </InputGroup>

                      <InputGroup label="Order Type">
                          <MinimalSelect value={formData.orderType} onChange={(e) => handleChange('orderType', e.target.value)}>
                              {Object.values(OrderType).map(type => <option key={type} value={type} className="bg-surface text-textMain">{type}</option>)}
                          </MinimalSelect>
                      </InputGroup>
                  </div>
              </section>

              <section>
                  <SectionHeader title="Financials" />
                  <div className="bg-surfaceHighlight/20 rounded-lg p-4 space-y-4 border border-border/40">
                      <div className="flex justify-between items-center">
                          <span className="text-xs text-textMuted font-medium uppercase">Net P&L</span>
                          <span className={`text-2xl font-bold font-mono ${calculatedFinancials.netPnlValue >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {calculatedFinancials.netPnlValue >= 0 ? '+' : ''}{calculatedFinancials.netPnlDisplay !== '-' ? `$${calculatedFinancials.netPnlValue.toFixed(2)}` : '-'}
                          </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
                          <div>
                              <span className="block text-[10px] text-textMuted uppercase mb-1">Fees</span>
                              <MinimalInput 
                                type="number" 
                                step="any"
                                value={formData.fees} 
                                onChange={(e) => handleChange('fees', e.target.value)} 
                                className="font-mono text-xs"
                              />
                          </div>
                          <div>
                              <span className="block text-[10px] text-textMuted uppercase mb-1">RR Ratio</span>
                              <div className="h-[34px] flex items-center text-sm font-mono text-primary">
                                  {calculatedFinancials.rr > 0 ? `1:${calculatedFinancials.rr.toFixed(2)}` : '-'}
                              </div>
                          </div>
                      </div>
                  </div>
              </section>

              <section>
                  <SectionHeader title="Tags" />
                  <div className="bg-surfaceHighlight/20 rounded-lg p-3 border border-border/40">
                      <div className="flex flex-wrap gap-2 mb-3 min-h-[30px]">
                          {formData.tags.map((tag: string) => (
                              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-primary/10 text-primary border border-primary/20">
                                  {tag}
                                  <button onClick={() => toggleTag(tag)} className="hover:text-textMain"><X size={10}/></button>
                              </span>
                          ))}
                          {formData.tags.length === 0 && <span className="text-xs text-textMuted italic p-1">No tags selected</span>}
                      </div>
                      
                      <div className="border-t border-border/40 pt-2 max-h-[200px] overflow-y-auto">
                          {tagGroups.map((group) => {
                              const isExpanded = expandedTagGroup === group.name;
                              return (
                                  <div key={group.name} className="mb-1">
                                      <button 
                                        onClick={() => setExpandedTagGroup(isExpanded ? null : group.name)}
                                        className="w-full flex justify-between items-center p-1.5 text-xs font-medium text-textMuted hover:text-textMain hover:bg-surfaceHighlight/30 rounded transition-colors"
                                      >
                                          {group.name}
                                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      </button>
                                      {isExpanded && (
                                          <div className="p-1.5 flex flex-wrap gap-1.5">
                                              {group.tags.map(tag => (
                                                  <button
                                                    key={tag}
                                                    onClick={() => toggleTag(tag)}
                                                    className={`px-1.5 py-0.5 rounded text-[9px] border transition-colors ${
                                                        formData.tags.includes(tag) 
                                                        ? 'bg-primary text-white border-primary' 
                                                        : 'bg-surface border-border/60 text-textMuted hover:border-primary/40'
                                                    }`}
                                                  >
                                                      {tag}
                                                  </button>
                                              ))}
                                          </div>
                                      )}
                                  </div>
                              )
                          })}
                      </div>
                  </div>
              </section>
          </div>

          <div className="lg:col-span-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Entry & Risk Column */}
                  <div className="space-y-6">
                      <section>
                          <SectionHeader title="Entry & Risk" />
                          <div className="bg-surfaceHighlight/10 border border-border/40 rounded-lg p-4 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                  <InputGroup label="Lot Size">
                                      <MinimalInput 
                                        type="number" 
                                        step="any"
                                        value={formData.quantity} 
                                        onChange={(e) => handleChange('quantity', e.target.value)} 
                                      />
                                  </InputGroup>
                                  <InputGroup label="Risk %">
                                      <MinimalInput 
                                        type="number" 
                                        step="any"
                                        value={formData.riskPercentage || ''} 
                                        onChange={(e) => handleChange('riskPercentage', e.target.value)} 
                                      />
                                  </InputGroup>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <InputGroup label="Entry Price">
                                      <MinimalInput 
                                        type="number" 
                                        step="any"
                                        value={formData.entryPrice} 
                                        onChange={(e) => handleChange('entryPrice', e.target.value)} 
                                      />
                                  </InputGroup>
                                  <InputGroup label="Entry Time">
                                      <input 
                                          type="datetime-local" 
                                          value={getInputValue(formData.entryDate)}
                                          onChange={(e) => handleDateTimeChange('entry', e.target.value)}
                                          className="w-full bg-transparent border border-border/40 rounded-md px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary"
                                      />
                                  </InputGroup>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <InputGroup label="Stop Loss">
                                      <MinimalInput 
                                        type="number" 
                                        step="any"
                                        value={formData.stopLoss} 
                                        onChange={(e) => handleChange('stopLoss', e.target.value)} 
                                      />
                                      {slPips && <span className="text-[10px] text-textMuted ml-1">{slPips} pips</span>}
                                  </InputGroup>
                                  <InputGroup label="Take Profit">
                                      <MinimalInput 
                                        type="number" 
                                        step="any"
                                        value={formData.takeProfit} 
                                        onChange={(e) => handleChange('takeProfit', e.target.value)} 
                                      />
                                      {tpPips && <span className="text-[10px] text-textMuted ml-1">{tpPips} pips</span>}
                                  </InputGroup>
                              </div>
                          </div>
                      </section>
                  </div>

                  {/* Exit & Outcome Column */}
                  <div className="space-y-6">
                      <section>
                          <div className="flex justify-between items-center mb-3">
                              <SectionHeader title="Outcome" />
                              <div className="flex gap-2">
                                  {isMissed ? (
                                      <button 
                                        onClick={() => setIsReopenModalOpen(true)} // Reopen missed logic same as reopen closed
                                        className="text-[10px] bg-surfaceHighlight hover:bg-border px-2 py-1 rounded text-textMain border border-border"
                                      >
                                          Activate Trade
                                      </button>
                                  ) : isClosed ? (
                                      <button 
                                        onClick={() => setIsReopenModalOpen(true)}
                                        className="text-[10px] bg-surfaceHighlight hover:bg-border px-2 py-1 rounded text-textMain border border-border"
                                      >
                                          Reopen Trade
                                      </button>
                                  ) : (
                                      <>
                                        <button 
                                            onClick={() => setIsCloseModalOpen(true)}
                                            className="text-[10px] bg-primary hover:bg-blue-600 text-white px-2 py-1 rounded shadow-sm"
                                        >
                                            Close Trade
                                        </button>
                                        <button 
                                            onClick={() => setIsMissedModalOpen(true)}
                                            className="text-[10px] bg-surfaceHighlight hover:bg-border px-2 py-1 rounded text-textMuted border border-border"
                                        >
                                            Mark Missed
                                        </button>
                                      </>
                                  )}
                              </div>
                          </div>
                          
                          <div className={`bg-surfaceHighlight/10 border border-border/40 rounded-lg p-4 space-y-4 ${isClosed || isMissed ? '' : 'opacity-50 pointer-events-none'}`}>
                              <div className="grid grid-cols-2 gap-4">
                                  <InputGroup label="Exit Price">
                                      <MinimalInput 
                                        type="number" 
                                        step="any"
                                        value={formData.exitPrice} 
                                        onChange={(e) => handleChange('exitPrice', e.target.value)} 
                                        disabled={!isClosed}
                                      />
                                  </InputGroup>
                                  <InputGroup label="Exit Time">
                                      <input 
                                          type="datetime-local" 
                                          value={getInputValue(formData.exitDate)}
                                          onChange={(e) => handleDateTimeChange('exit', e.target.value)}
                                          className="w-full bg-transparent border border-border/40 rounded-md px-2 py-1.5 text-xs text-textMain focus:outline-none focus:border-primary disabled:opacity-50"
                                          disabled={!isClosed}
                                      />
                                  </InputGroup>
                              </div>
                              <InputGroup label="Core P&L">
                                  <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-textMuted text-xs">$</span>
                                      <MinimalInput 
                                        type="number" 
                                        step="any"
                                        value={formData.mainPnl} 
                                        onChange={(e) => handleChange('mainPnl', e.target.value)} 
                                        className="pl-5 font-bold"
                                        disabled={!isClosed}
                                      />
                                  </div>
                              </InputGroup>
                          </div>
                      </section>
                  </div>
              </div>

              {/* Partials Table */}
              <section>
                  <div className="flex justify-between items-center mb-3">
                      <SectionHeader title="Partials" />
                  </div>
                  <div className="bg-surface border border-border/40 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                          <thead className="bg-surfaceHighlight/50 text-textMuted font-medium border-b border-border/40">
                              <tr>
                                  <th className="p-3">Date</th>
                                  <th className="p-3">Lot</th>
                                  <th className="p-3">Price</th>
                                  <th className="p-3 text-right">P&L</th>
                                  <th className="p-3 w-8"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                              {formData.partials.map((p: TradePartial) => (
                                  <tr key={p.id} className="group hover:bg-surfaceHighlight/20">
                                      <td className="p-3 text-textMuted">{p.date ? new Date(p.date).toLocaleDateString() : '-'}</td>
                                      <td className="p-3 font-mono">{p.quantity}</td>
                                      <td className="p-3 font-mono">{p.price || '-'}</td>
                                      <td className={`p-3 text-right font-bold ${p.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>${p.pnl.toFixed(2)}</td>
                                      <td className="p-3 text-center">
                                          <button onClick={() => handleRemovePartial(p.id)} className="text-textMuted hover:text-loss opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                      </td>
                                  </tr>
                              ))}
                              {/* Add Row */}
                              <tr className="bg-surfaceHighlight/5">
                                  <td className="p-2">
                                      <input 
                                        type="datetime-local" 
                                        value={newPartial.dateTime} 
                                        onChange={(e) => setNewPartial({...newPartial, dateTime: e.target.value})}
                                        className="w-full bg-transparent border-b border-border/30 text-xs text-textMain focus:outline-none"
                                      />
                                  </td>
                                  <td className="p-2"><MinimalInput placeholder="Lot" value={newPartial.lot} onChange={(e) => setNewPartial({...newPartial, lot: e.target.value})} className="h-7 text-xs"/></td>
                                  <td className="p-2"><MinimalInput placeholder="Price" value={newPartial.price} onChange={(e) => setNewPartial({...newPartial, price: e.target.value})} className="h-7 text-xs"/></td>
                                  <td className="p-2"><MinimalInput placeholder="P&L" value={newPartial.pnl} onChange={(e) => setNewPartial({...newPartial, pnl: e.target.value})} className="h-7 text-xs text-right"/></td>
                                  <td className="p-2 text-center">
                                      <button onClick={handleAddPartial} disabled={!newPartial.lot || !newPartial.pnl} className="text-primary hover:text-blue-600 disabled:opacity-30"><Plus size={14}/></button>
                                  </td>
                              </tr>
                          </tbody>
                      </table>
                  </div>
              </section>

              {/* Notes */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <SectionHeader title="Technical Notes" />
                      <textarea 
                          value={formData.notes}
                          onChange={(e) => handleChange('notes', e.target.value)}
                          className="w-full bg-surface border border-border/40 rounded-lg p-3 text-sm text-textMain focus:outline-none focus:border-primary resize-none min-h-[120px]"
                          placeholder="Analysis, setup details..."
                      />
                  </div>
                  <div>
                      <SectionHeader title="Emotional Notes" />
                      <textarea 
                          value={formData.emotionalNotes}
                          onChange={(e) => handleChange('emotionalNotes', e.target.value)}
                          className="w-full bg-surface border border-border/40 rounded-lg p-3 text-sm text-textMain focus:outline-none focus:border-primary resize-none min-h-[120px]"
                          placeholder="How did you feel?"
                      />
                  </div>
              </section>

              {/* Screenshots */}
              <section>
                  <div className="flex justify-between items-center mb-3">
                      <SectionHeader title="Screenshots" />
                      <div className="flex gap-2">
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                          <button onClick={() => fileInputRef.current?.click()} className="text-[10px] flex items-center gap-1 bg-surfaceHighlight hover:bg-border px-2 py-1 rounded text-textMuted border border-border transition-colors"><Upload size={10}/> Upload</button>
                          <button onClick={handlePasteClick} className="text-[10px] flex items-center gap-1 bg-surfaceHighlight hover:bg-border px-2 py-1 rounded text-textMuted border border-border transition-colors"><Clipboard size={10}/> Paste</button>
                      </div>
                  </div>
                  
                  {formData.screenshots.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {formData.screenshots.map((url: string, idx: number) => (
                              <div key={idx} className="relative group aspect-video bg-black/50 rounded-lg overflow-hidden border border-border cursor-pointer" onClick={() => setSelectedImage(url)}>
                                  <img src={url} alt={`Screenshot ${idx}`} className="w-full h-full object-cover" />
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                                    className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                      <Trash2 size={10} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="border border-dashed border-border rounded-lg p-6 text-center">
                          <p className="text-xs text-textMuted">No screenshots yet.</p>
                      </div>
                  )}
              </section>
          </div>
      </div>

      {isCloseModalOpen && (
          <CloseTradeModal 
            currentData={formData}
            tagGroups={tagGroups}
            onClose={() => setIsCloseModalOpen(false)}
            onConfirm={handleCloseModalConfirm}
          />
      )}

      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[70] p-4 animate-in fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button className="absolute -top-12 right-0 text-white p-2"><X size={24} /></button>
            <img src={selectedImage} alt="Full" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
          </div>
        </div>
      )}

      <ConfirmModal 
          isOpen={isReopenModalOpen} 
          title="Reopen Trade?" 
          message="This will reset the trade status to OPEN. If balance was updated, it will be reversed." 
          onConfirm={handleConfirmReopen} 
          onCancel={() => setIsReopenModalOpen(false)} 
      />

      <ConfirmModal 
          isOpen={isMissedModalOpen} 
          title="Mark as Missed?" 
          message="This will set the trade status to MISSED. PnL will be 0." 
          onConfirm={handleConfirmMissed} 
          onCancel={() => setIsMissedModalOpen(false)} 
      />
    </div>
  );
};

export default TradeDetail;
