
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Trade, TradeType, TradeStatus, ASSETS, TradeOutcome, Session, OrderType, Account, TradePartial, TagGroup } from '../types';
import { ArrowLeft, Trash2, Plus, X, Upload, ChevronDown, ChevronUp, Clipboard, Loader2, Copy } from 'lucide-react';
import { getSessionForTime } from '../utils/sessionHelpers';
import CloseTradeModal from './CloseTradeModal';
import { calculateAutoTags } from '../utils/autoTagLogic';
import { toLocalInputString, formatDisplayDate } from '../utils/dateUtils';
import { compressImage, addScreenshot } from '../utils/imageUtils';
import { generateId } from '../utils/idUtils';
import { uploadImage, deleteBlobImages } from '../services/storageService';
import { getBaseQuote } from '../utils/symbol';
import PlannedMoney from './PlannedMoney';
import { getFxRateToUSD } from '../services/fxService';
import { computePlannedValuesForSave } from '../utils/tradeCalc';

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
  onSave: (trade: Trade, shouldClose?: boolean, balanceChange?: number) => void;
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
    finalTakeProfit: trade.finalTakeProfit ? trade.finalTakeProfit.toString() : '',
    finalStopLoss: trade.finalStopLoss ? trade.finalStopLoss.toString() : '',
    setup: trade.setup || ''
  });

  const [newPartial, setNewPartial] = useState({ lot: '', price: '', pnl: '', dateTime: '' });
  const [expandedTagGroup, setExpandedTagGroup] = useState<string | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isMissedModalOpen, setIsMissedModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Ref for Auto-Save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDataRef = useRef(formData);
  const isFirstRender = useRef(true);
  
  // Sync ref
  useEffect(() => { formDataRef.current = formData; }, [formData]);

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
    
    const feesVal = parseFloat(formData.fees) || 0;

    let netPnlDisplay: string | number = '-';
    let netPnlValue = 0; 

    // Net PnL = Main + Partials - Fees
    
    if (hasMainPnl) {
        netPnlValue = mainPnlVal + partialsTotal - feesVal;
        netPnlDisplay = netPnlValue;
    } else if (hasPartials) {
        netPnlValue = partialsTotal - feesVal;
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
    
    const quoteInfo = getBaseQuote(formData.symbol);
    const quoteCurrency = quoteInfo ? quoteInfo.quote : 'USD';

    return {
        partialsTotal,
        netPnlValue,
        netPnlDisplay,
        feesValue: feesVal,
        plannedReward,
        rr,
        quoteCurrency
    };
  }, [formData, asset]);
  
  const financialsRef = useRef(calculatedFinancials);
  useEffect(() => { financialsRef.current = calculatedFinancials; }, [calculatedFinancials]);

  const getPips = (priceStr: string) => {
      if (!asset || !formData.entryPrice || !priceStr) return null;
      const entry = parseFloat(formData.entryPrice);
      const target = parseFloat(priceStr);
      if (isNaN(entry) || isNaN(target)) return null;
      return (Math.abs(target - entry) / asset.pip).toFixed(1);
  }
  
  const slPips = getPips(formData.stopLoss);
  const tpPips = getPips(formData.takeProfit);

  // Helper to determine if we need to fetch/recalc FX values
  const getPlannedValuesForSave = async (snapshot: any) => {
      const isDirty = (
          trade.symbol !== snapshot.symbol ||
          Number(trade.entryPrice || 0) !== Number(snapshot.entryPrice || 0) ||
          Number(trade.stopLoss || 0) !== Number(snapshot.stopLoss || 0) ||
          Number(trade.takeProfit || 0) !== Number(snapshot.takeProfit || 0) ||
          Number(trade.quantity || 0) !== Number(snapshot.quantity || 0)
      );

      if (!isDirty) {
          return {
              quoteCurrency: trade.quoteCurrency,
              fxRateToUsd: trade.fxRateToUsd,
              plannedRiskQuote: trade.plannedRiskQuote,
              plannedRewardQuote: trade.plannedRewardQuote,
              plannedRiskUsd: trade.plannedRiskUsd,
              plannedRewardUsd: trade.plannedRewardUsd
          };
      }

      const info = getBaseQuote(snapshot.symbol);
      const quote = info ? info.quote : 'USD';
      let rate = 1;

      if (quote !== 'USD') {
          // If symbol hasn't changed and we have a valid stored rate, reuse it (no fetch)
          if (snapshot.symbol === trade.symbol && trade.fxRateToUsd && trade.fxRateToUsd > 0) {
              rate = trade.fxRateToUsd;
          } else {
              // Only fetch if symbol changed OR legacy trade didn't have a rate
              const fetched = await getFxRateToUSD(quote);
              if (fetched) rate = fetched;
          }
      }
      
      return computePlannedValuesForSave(snapshot, rate);
  };

  const performSave = async (currentFormData: any, currentFinancials: any) => {
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
      const fees = parseFloat(currentFormData.fees) || 0;
      const takeProfit = parseFloat(currentFormData.takeProfit) || undefined;
      const stopLoss = parseFloat(currentFormData.stopLoss) || undefined;
      const finalTakeProfit = parseFloat(currentFormData.finalTakeProfit) || undefined;
      const finalStopLoss = parseFloat(currentFormData.finalStopLoss) || undefined;
      const mainPnl = currentFormData.mainPnl === '' ? undefined : parseFloat(currentFormData.mainPnl);

      // Smart calculation of planned values (minimizes API calls)
      const plannedValues = await getPlannedValuesForSave(currentFormData);

      const updatedTrade: Trade = {
          ...currentFormData,
          tags: updatedTags, 
          entryPrice,
          exitPrice: currentFormData.exitPrice ? exitPrice : undefined,
          quantity,
          fees,
          takeProfit,
          stopLoss,
          finalTakeProfit,
          finalStopLoss,
          mainPnl,
          pnl: net,
          status,
          isBalanceUpdated: currentFormData.isBalanceUpdated,
          ...plannedValues
      };
      
      // Auto-save does not impact balance
      onSave(updatedTrade, false, 0);
      
      // Update local tags if changed by calculation
      if (JSON.stringify(updatedTags) !== JSON.stringify(currentFormData.tags)) {
          setFormData((prev: any) => ({ ...prev, tags: updatedTags }));
      }
  };

  // Ref to hold the latest version of performSave
  const performSaveRef = useRef(performSave);
  useEffect(() => { performSaveRef.current = performSave; });

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

  // Separate effect for unmount saving
  useEffect(() => {
      return () => {
          if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
          if (!isFirstRender.current) {
              performSaveRef.current(formDataRef.current, financialsRef.current);
          }
      };
  }, []);

  // Paste Listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (isCloseModalOpen) return; // Prevent double handling if modal is open

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
                 setFormData((prev: any) => {
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
  }, [isCloseModalOpen]);

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
                  setFormData((prev: any) => {
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

  const handleRemoveImage = async (index: number) => {
      const urlToRemove = formData.screenshots[index];
      if (urlToRemove) {
          try {
              // Best-effort delete from Vercel Blob
              await deleteBlobImages([urlToRemove]);
          } catch (e) {
              console.error("Failed to delete blob:", e);
          }
      }
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

  const handleConfirmReopen = async () => {
      let reverseAmount = 0;
      if (formData.isBalanceUpdated) {
          // Revert balance: subtract the PnL that was added
          reverseAmount = formData.pnl * -1;
      }

      const updatedForm = {
          ...formData,
          outcome: TradeOutcome.OPEN,
          isBalanceUpdated: false
      };
      
      setFormData(updatedForm);
      setIsReopenModalOpen(false);
      
      const plannedValues = await getPlannedValuesForSave(updatedForm);
      
      const tradeToSave = { 
          ...updatedForm, 
          pnl: 0, 
          status: TradeStatus.OPEN,
          ...plannedValues
      };
      onSave(tradeToSave, false, reverseAmount);
  };

  const handleConfirmMissed = async () => {
      let reverseAmount = 0;
      if (formData.outcome === TradeOutcome.CLOSED && formData.isBalanceUpdated) {
          reverseAmount = formData.pnl * -1;
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

      const plannedValues = await getPlannedValuesForSave(updatedForm);

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
          status: TradeStatus.MISSED,
          ...plannedValues
      };
      onSave(tradeToSave, false, reverseAmount);
  };

  const handleCloseModalConfirm = async (closedData: any) => {
      const updatedFormData = {
          ...formData,
          ...closedData,
          outcome: TradeOutcome.CLOSED
      };
      const affectBalance = closedData.affectBalance;
      delete updatedFormData.affectBalance;

      const main = parseFloat(updatedFormData.mainPnl) || 0;
      const fees = parseFloat(updatedFormData.fees) || 0;
      const partialsTotal = (updatedFormData.partials || []).reduce((acc: number, p: TradePartial) => acc + (p.pnl || 0), 0);
      const net = main + partialsTotal - fees;
      
      let status = TradeStatus.BREAK_EVEN;
      if (net > 0) status = TradeStatus.WIN;
      else if (net < 0) status = TradeStatus.LOSS;

      updatedFormData.isBalanceUpdated = !!affectBalance;

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

      const plannedValues = await getPlannedValuesForSave(updatedFormData);

      const finalTradeToSave: Trade = {
        ...updatedFormData,
        entryPrice: parseFloat(updatedFormData.entryPrice),
        exitPrice: updatedFormData.exitPrice ? parseFloat(updatedFormData.exitPrice) : undefined,
        quantity: parseFloat(updatedFormData.quantity),
        fees: fees, 
        takeProfit: updatedFormData.takeProfit ? parseFloat(updatedFormData.takeProfit) : undefined,
        stopLoss: updatedFormData.stopLoss ? parseFloat(updatedFormData.stopLoss) : undefined,
        finalTakeProfit: updatedFormData.finalTakeProfit ? parseFloat(updatedFormData.finalTakeProfit) : undefined,
        finalStopLoss: updatedFormData.finalStopLoss ? parseFloat(updatedFormData.finalStopLoss) : undefined,
        mainPnl: updatedFormData.mainPnl === '' ? undefined : parseFloat(updatedFormData.mainPnl),
        pnl: net,
        status,
        ...plannedValues
      };

      // Calculate DELTA for balance update to support re-editing
      // If it was already updated, we subtract the old PnL (revert) and add the new PnL (apply)
      // Or simply: New Effect - Old Effect
      const oldBalanceEffect = formData.isBalanceUpdated ? (formData.pnl || 0) : 0;
      const newBalanceEffect = affectBalance ? net : 0;
      const balanceChange = newBalanceEffect - oldBalanceEffect;

      setFormData(updatedFormData);
      onSave(finalTradeToSave, false, balanceChange);
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
        id: generateId('partial'),
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
          setIsUploading(true);
          const base64 = await compressImage(file);
          const uniqueName = `pasted_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
          const url = await uploadImage(uniqueName, base64);
          setFormData((prev: any) => {
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
  
  // Safe manual back to list (ensures flush)
  const handleBack = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      performSaveRef.current(formDataRef.current, financialsRef.current);
      onBack();
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 animate-in fade-in duration-300 font-sans -mt-4">
      
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between py-3 mb-6 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
         <div className="flex items-center gap-4">
             <button onClick={handleBack} className="p-2 hover:bg-surfaceHighlight rounded-full transition-colors text-textMuted hover:text-textMain">
                 <ArrowLeft size={20} />
             </button>
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
                            {ASSETS.map(asset => (
                                <option key={asset.id} value={asset.assetPair} className="bg-surface text-textMain">
                                    {asset.assetPair}
                                </option>
                            ))}
                        </select>
                     </div>
                     <span className={`text-xs px-2 py-0.5 border rounded ${
                         formData.type === TradeType.LONG ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-500'
                     }`}>
                         {formData.type}
                     </span>
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
          
          {/* LEFT COLUMN: Context & Execution (4 Cols) */}
          <div className="lg:col-span-4 space-y-8">
              
              {/* Context Section */}
              <section>
                  <SectionHeader title="Trade Context" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                      {/* Row 1 */}
                      <InputGroup label="Account">
                          <div className="h-[34px] flex items-center px-2 text-sm font-medium border border-border/40 rounded-md">
                             {account?.name || '-'} <span className="text-xs text-textMuted ml-2">({account?.type || (account?.isDemo ? 'Demo' : 'Real')})</span>
                          </div>
                      </InputGroup>
                      
                      <InputGroup label="Outcome">
                          <MinimalSelect value={formData.outcome} onChange={(e) => handleChange('outcome', e.target.value)} className="bg-surface">
                              {Object.values(TradeOutcome).map(v => <option key={v} value={v} className="bg-surface text-textMain">{v}</option>)}
                          </MinimalSelect>
                      </InputGroup>

                      {/* Row 2 */}
                      <InputGroup label="Entry Price">
                          <MinimalInput 
                            type="number" 
                            step="any" 
                            value={formData.entryPrice} 
                            onChange={(e) => handleChange('entryPrice', e.target.value)} 
                            disabled={isClosed}
                          />
                      </InputGroup>
                      <InputGroup label="Exit Price">
                          <MinimalInput 
                            type="number" 
                            step="any" 
                            value={formData.exitPrice} 
                            onChange={(e) => handleChange('exitPrice', e.target.value)} 
                            placeholder="-"
                            disabled={isClosed || isMissed}
                          />
                      </InputGroup>

                      {/* Row 3 - Single Field Date/Time with Display */}
                      <InputGroup label="Entry Time">
                          <div>
                            <MinimalInput 
                                type="datetime-local" 
                                value={toLocalInputString(formData.entryDate)} 
                                onChange={(e) => handleDateTimeChange('entry', e.target.value)}
                                disabled={isClosed || isMissed}
                            />
                            <div className="text-[10px] text-textMuted mt-1 font-mono">
                                {formData.entryTime ? formatDisplayDate(formData.entryDate) : `Log Time: ${formatDisplayDate(formData.entryDate)}`}
                            </div>
                          </div>
                      </InputGroup>
                      <InputGroup label="Exit Time">
                          <div>
                            <MinimalInput 
                                type="datetime-local" 
                                value={toLocalInputString(formData.exitDate)} 
                                onChange={(e) => handleDateTimeChange('exit', e.target.value)}
                                disabled={isClosed || isMissed}
                            />
                            <div className="text-[10px] text-textMuted mt-1 font-mono">
                                {formData.exitDate ? formatDisplayDate(formData.exitDate) : '-'}
                            </div>
                          </div>
                      </InputGroup>

                      {/* Row 4 - Sessions (Read Only) */}
                      <InputGroup label="Entry Session">
                           <MinimalInput 
                              readOnly
                              value={formData.entrySession || '-'} 
                              className="bg-surfaceHighlight/30 text-textMuted cursor-default"
                              tabIndex={-1}
                           />
                      </InputGroup>

                      <InputGroup label="Exit Session">
                           <MinimalInput 
                              readOnly
                              value={formData.exitSession || '-'} 
                              className="bg-surfaceHighlight/30 text-textMuted cursor-default"
                              tabIndex={-1}
                           />
                      </InputGroup>
                  </div>
              </section>

              {/* Execution Section */}
              <section>
                  <SectionHeader title="Execution" />
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                       <InputGroup label="Order Type">
                           <MinimalInput 
                              value={formData.orderType} 
                              readOnly
                              className="bg-surfaceHighlight/30 text-textMuted cursor-default" 
                              tabIndex={-1}
                            />
                      </InputGroup>
                      <InputGroup label="Strategy">
                           <MinimalSelect 
                              value={formData.setup} 
                              onChange={(e) => handleChange('setup', e.target.value)} 
                              className="bg-surface"
                           >
                              <option value="">Select Strategy</option>
                              {strategies.map(s => (
                                  <option key={s} value={s} className="bg-surface text-textMain">{s}</option>
                              ))}
                           </MinimalSelect>
                      </InputGroup>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <InputGroup label="Entry SL">
                              <div className="relative">
                                <MinimalInput type="number" step="any" value={formData.stopLoss} onChange={(e) => handleChange('stopLoss', e.target.value)} placeholder="-" disabled={isClosed} />
                                {slPips && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-textMuted font-mono">{slPips} pips</span>}
                              </div>
                          </InputGroup>
                          <InputGroup label="Entry TP">
                              <div className="relative">
                                <MinimalInput type="number" step="any" value={formData.takeProfit} onChange={(e) => handleChange('takeProfit', e.target.value)} placeholder="-" disabled={isClosed} />
                                {tpPips && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-textMuted font-mono">{tpPips} pips</span>}
                              </div>
                          </InputGroup>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <InputGroup label="Final SL">
                              <div className="flex items-center gap-1">
                                  <MinimalInput 
                                    type="number" 
                                    step="any" 
                                    value={formData.finalStopLoss} 
                                    onChange={(e) => handleChange('finalStopLoss', e.target.value)} 
                                    placeholder="-" 
                                    disabled={isClosed} 
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => handleChange('finalStopLoss', formData.stopLoss)}
                                    className="px-2 py-1.5 bg-surfaceHighlight border border-border/40 rounded-md text-[10px] text-textMuted hover:text-textMain hover:border-primary/50 transition-colors disabled:opacity-50"
                                    title="Copy Entry SL"
                                    disabled={isClosed}
                                  >
                                    same
                                  </button>
                              </div>
                          </InputGroup>
                          <InputGroup label="Final TP">
                              <div className="flex items-center gap-1">
                                  <MinimalInput 
                                    type="number" 
                                    step="any" 
                                    value={formData.finalTakeProfit} 
                                    onChange={(e) => handleChange('finalTakeProfit', e.target.value)} 
                                    placeholder="-" 
                                    disabled={isClosed} 
                                  />
                                  <button 
                                    type="button"
                                    onClick={() => handleChange('finalTakeProfit', formData.takeProfit)}
                                    className="px-2 py-1.5 bg-surfaceHighlight border border-border/40 rounded-md text-[10px] text-textMuted hover:text-textMain hover:border-primary/50 transition-colors disabled:opacity-50"
                                    title="Copy Entry TP"
                                    disabled={isClosed}
                                  >
                                    same
                                  </button>
                              </div>
                          </InputGroup>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                           <InputGroup label="Lot Size">
                              <MinimalInput type="number" step="any" value={formData.quantity} onChange={(e) => handleChange('quantity', e.target.value)} disabled={isClosed} />
                          </InputGroup>
                          <InputGroup label="Planned Reward">
                              <div className="h-[34px] flex items-center px-2 text-sm font-medium border border-border/40 rounded-md text-textMain">
                                  <PlannedMoney 
                                      quoteAmount={calculatedFinancials.plannedReward} 
                                      quoteCurrency={calculatedFinancials.quoteCurrency}
                                      precalculatedUsd={trade.plannedRewardUsd}
                                      className="text-sm font-medium" 
                                  />
                              </div>
                          </InputGroup>
                      </div>
                      
                      <InputGroup label="RR Ratio">
                          <div className="h-[34px] flex items-center px-2 text-sm font-medium border border-border/40 rounded-md text-textMain">
                              {calculatedFinancials.rr > 0 ? `1:${calculatedFinancials.rr.toFixed(2)}` : '-'}
                          </div>
                      </InputGroup>
                  </div>
              </section>

          </div>

          {/* MIDDLE COLUMN: Financials & Partials (4 Cols) */}
          <div className="lg:col-span-4 space-y-8">
              <section>
                  <SectionHeader title="Financials" />
                  
                  {/* PnL Box */}
                  <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                      {/* Row 1: Net PnL (Read-Only) */}
                      <div className="text-center mb-6">
                          <label className="text-[10px] uppercase text-textMuted font-bold mb-1 block">Net P&L (Calc)</label>
                          <div className={`text-3xl font-bold ${
                              typeof calculatedFinancials.netPnlDisplay === 'number' 
                                  ? (calculatedFinancials.netPnlDisplay >= 0 ? 'text-profit' : 'text-loss') 
                                  : 'text-textMuted'
                          }`}>
                              {typeof calculatedFinancials.netPnlDisplay === 'number' 
                                  ? `$${calculatedFinancials.netPnlDisplay.toFixed(2)}` 
                                  : calculatedFinancials.netPnlDisplay}
                          </div>
                      </div>

                      {/* Row 2: Core Profit | Partials Profit | Fees */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                              <label className="text-[10px] uppercase text-textMuted mb-1 block">Core P&L</label>
                              <div className="relative">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-textMuted">$</span>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={formData.mainPnl}
                                    onChange={(e) => handleChange('mainPnl', e.target.value)}
                                    className={`w-full bg-transparent text-center text-sm font-bold text-textMain focus:outline-none border-b border-border/30 hover:border-border ${isClosed || isMissed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="-"
                                    disabled={isClosed || isMissed}
                                />
                              </div>
                          </div>
                          <div>
                              <label className="text-[10px] uppercase text-textMuted mb-1 block">Partials Profit</label>
                              <div className="text-sm font-bold text-textMain py-1.5">${calculatedFinancials.partialsTotal.toFixed(2)}</div>
                          </div>
                          <div>
                              <label className="text-[10px] uppercase text-textMuted mb-1 block">Fees</label>
                              <div className="relative">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-textMuted">$</span>
                                <input 
                                    type="number" 
                                    step="any"
                                    value={formData.fees}
                                    onChange={(e) => handleChange('fees', e.target.value)}
                                    className={`w-full bg-transparent text-center text-sm font-bold text-textMain focus:outline-none border-b border-border/30 hover:border-border ${isClosed || isMissed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    placeholder="0.00"
                                    disabled={isClosed || isMissed}
                                />
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Partials Manager */}
                  <div className="mt-8">
                      <SectionHeader title="Partial Profits" />
                      <div className="bg-surface border border-border rounded-lg overflow-hidden">
                          {/* Partials Header */}
                          <div className="grid grid-cols-12 gap-2 p-2 bg-surfaceHighlight/30 text-[10px] font-bold text-textMuted uppercase border-b border-border/50">
                              <div className="col-span-2">Lot</div>
                              <div className="col-span-3">Exit Price</div>
                              <div className="col-span-3">P&L</div>
                              <div className="col-span-3">Time</div>
                              <div className="col-span-1"></div>
                          </div>

                          {/* List */}
                          {formData.partials.length === 0 && (
                              <div className="p-4 text-center text-xs text-textMuted italic">No partials recorded.</div>
                          )}
                          {formData.partials.map((p: TradePartial) => (
                              <div key={p.id} className="grid grid-cols-12 gap-2 items-center p-2 border-b border-border/50 text-xs last:border-0 hover:bg-surfaceHighlight/10">
                                  <div className="col-span-2 font-mono">{p.quantity}</div>
                                  <div className="col-span-3 font-mono">{p.price || '-'}</div>
                                  <div className="col-span-3 font-mono font-bold text-textMain">${p.pnl}</div>
                                  <div className="col-span-3 text-[10px] text-textMuted truncate">{formatDisplayDate(p.date || '')}</div>
                                  <div className="col-span-1 text-right">
                                      <button onClick={() => handleRemovePartial(p.id)} disabled={isClosed} className={`text-textMuted ${isClosed ? 'opacity-50 cursor-not-allowed' : 'hover:text-loss'}`}><X size={12}/></button>
                                  </div>
                              </div>
                          ))}
                          
                          {/* Add Partial Input Row */}
                          <div className={`p-2 bg-surfaceHighlight/20 border-t border-border/50 space-y-2 ${isClosed || isMissed ? 'opacity-50 pointer-events-none' : ''}`}>
                              <div className="grid grid-cols-12 gap-2">
                                  <div className="col-span-2">
                                      <input type="number" placeholder="Lot" className="w-full bg-background border border-border/60 rounded px-1 py-1 text-xs" value={newPartial.lot} onChange={e => setNewPartial({...newPartial, lot: e.target.value})} disabled={isClosed || isMissed} />
                                  </div>
                                  <div className="col-span-3">
                                      <input type="number" placeholder="Exit Price" className="w-full bg-background border border-border/60 rounded px-1 py-1 text-xs" value={newPartial.price} onChange={e => setNewPartial({...newPartial, price: e.target.value})} disabled={isClosed || isMissed} />
                                  </div>
                                  <div className="col-span-3">
                                      <input type="number" placeholder="P&L" className="w-full bg-background border border-border/60 rounded px-1 py-1 text-xs" value={newPartial.pnl} onChange={e => setNewPartial({...newPartial, pnl: e.target.value})} disabled={isClosed || isMissed} />
                                  </div>
                                  <div className="col-span-4">
                                      <input 
                                        type="datetime-local" 
                                        className="w-full bg-background border border-border/60 rounded px-1 py-1 text-[10px]" 
                                        value={newPartial.dateTime} 
                                        onChange={e => setNewPartial({...newPartial, dateTime: e.target.value})} 
                                        disabled={isClosed || isMissed}
                                      />
                                      {newPartial.dateTime && (
                                        <div className="text-[9px] text-textMuted mt-0.5 font-mono">
                                            {formatDisplayDate(new Date(newPartial.dateTime).toISOString())}
                                        </div>
                                      )}
                                  </div>
                              </div>
                              <div className="flex justify-end pt-2">
                                  <button onClick={handleAddPartial} disabled={isClosed || isMissed} className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-blue-600 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={12}/> Add Partial</button>
                              </div>
                          </div>
                      </div>
                  </div>
              </section>
          </div>

          {/* RIGHT COLUMN: Journal & Media (4 Cols) */}
          <div className="lg:col-span-4 space-y-8">
              
              <section>
                  <SectionHeader title="Journal" />
                  <div className="space-y-6">
                      <InputGroup label="Technical Notes">
                          <textarea 
                              value={formData.notes}
                              onChange={(e) => handleChange('notes', e.target.value)}
                              className="w-full bg-transparent border border-border/40 rounded-md p-3 text-sm text-textMain focus:outline-none focus:border-primary min-h-[100px] resize-none"
                              placeholder="Strategy, Setup details..."
                          />
                      </InputGroup>
                      
                      <InputGroup label="Emotional Notes">
                          <textarea 
                              value={formData.emotionalNotes}
                              onChange={(e) => handleChange('emotionalNotes', e.target.value)}
                              className="w-full bg-transparent border border-border/40 rounded-md p-3 text-sm text-textMain focus:outline-none focus:border-primary min-h-[80px] resize-none"
                              placeholder="How did you feel?"
                          />
                      </InputGroup>

                      {/* Tag Groups Selector */}
                      <div>
                          <label className="text-[10px] uppercase text-textMuted font-medium block mb-2">Tags</label>
                          <div className="space-y-2">
                             {/* Active Tags Display */}
                             <div className="flex flex-wrap gap-2 mb-4">
                                  {formData.tags.map((tag: string) => (
                                      <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                                          {tag}
                                          <button onClick={() => toggleTag(tag)} className="hover:text-primary"><X size={10}/></button>
                                      </span>
                                  ))}
                                  {formData.tags.length === 0 && <span className="text-xs text-textMuted italic">No tags selected</span>}
                              </div>

                              {/* Groups Accordion */}
                              <div className="border border-border/40 rounded-md divide-y divide-border/40">
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
              </section>

              {/* Gallery */}
              <section>
                  <div className="flex justify-between items-end mb-4 border-b border-border/50 pb-2">
                      <SectionHeader title="Media" />
                      <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={handlePasteClick}
                            disabled={isUploading}
                            className="text-xs text-textMuted hover:text-textMain flex items-center gap-1 disabled:opacity-50"
                            title="Paste from Clipboard"
                          >
                             {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Clipboard size={12} />}
                          </button>
                          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50">
                              {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Upload
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                      {formData.screenshots.map((url: string, idx: number) => (
                          <div 
                            key={idx} 
                            onClick={() => setSelectedImage(url)}
                            className="aspect-square bg-surface border border-border/40 rounded-lg overflow-hidden cursor-pointer relative group"
                          >
                             <img src={url} alt="Trade Screenshot" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                             <button 
                                onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }} 
                                className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                             >
                                <X size={12} />
                             </button>
                          </div>
                      ))}
                  </div>
              </section>
          </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-in fade-in"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
            <img src={selectedImage} alt="Full size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}

      {/* Close Trade Modal */}
      {isCloseModalOpen && (
          <CloseTradeModal 
            currentData={formData}
            tagGroups={tagGroups}
            onClose={() => setIsCloseModalOpen(false)}
            onConfirm={handleCloseModalConfirm}
          />
      )}

      {/* Reopen Confirmation Modal */}
      <ConfirmModal 
          isOpen={isReopenModalOpen}
          title="Reopen Trade"
          message="Are you sure to reopen the closed trade? This will revert any balance changes made by closing this trade."
          onConfirm={handleConfirmReopen}
          onCancel={() => setIsReopenModalOpen(false)}
      />

      {/* Missed Confirmation Modal */}
      <ConfirmModal 
          isOpen={isMissedModalOpen}
          title="Mark as Missed"
          message="Are you sure to change the trade outcome to missed? You will loose all of your partial trades, if any. This will revert any balance changes."
          onConfirm={handleConfirmMissed}
          onCancel={() => setIsMissedModalOpen(false)}
      />
    </div>
  );
};

export default TradeDetail;
