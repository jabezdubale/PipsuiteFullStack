
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Trade, TradeType, TradeStatus, AVAILABLE_COLUMNS, ColumnKey, ASSETS, TradeOutcome, OrderType, Session, TagGroup } from '../types';
import { Trash2, Settings, Eye, X, ChevronLeft, ChevronRight, Check, Download, Upload, GripVertical, MousePointer2, CheckSquare, RotateCcw, ChevronDown, ChevronUp, Filter, Loader2, FilterX } from 'lucide-react';
import { calculateAutoTags } from '../utils/autoTagLogic';
import { generateId } from '../utils/idUtils';
import { getSetting, saveSetting } from '../services/storageService';
import { exportTradesToCSV } from '../utils/csvExport';
import { getBaseQuote } from '../utils/symbol';
import PlannedMoney from './PlannedMoney';

interface TradeListProps {
  trades: Trade[];
  selectedAccountId: string;
  onTradeClick: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void; 
  onDeleteTrades?: (ids: string[]) => void;
  onImportTrades?: (trades: Trade[]) => void;
  isTrash?: boolean;
  onRestoreTrades?: (ids: string[]) => void;
  tagGroups?: TagGroup[]; 
}

interface ColumnFilterState {
    type: 'date' | 'number' | 'tags' | 'select' | 'text';
    dateFrom?: string;
    dateTo?: string;
    operator?: '>' | '>=' | '<' | '<=' | '=';
    numberValue?: string;
    selectedTags?: string[];
    tagMatchMode?: 'any' | 'all'; 
    selectedValues?: string[]; 
    text?: string;
}

const TradeList: React.FC<TradeListProps> = ({ trades, selectedAccountId, onTradeClick, onDeleteTrade, onDeleteTrades, onImportTrades, isTrash = false, onRestoreTrades, tagGroups = [] }) => {
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(['createdAt', 'type', 'pnl', 'setup', 'outcome', 'tags']);
  const [columnsLoaded, setColumnsLoaded] = useState(false);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [itemsPerPageInput, setItemsPerPageInput] = useState("10");

  const [draggedColumn, setDraggedColumn] = useState<ColumnKey | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [activeFilters, setActiveFilters] = useState<Record<string, ColumnFilterState>>({});
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [expandedFilterTagGroups, setExpandedFilterTagGroups] = useState<Set<string>>(new Set());
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const loadColumns = async () => {
          const cols = await getSetting<ColumnKey[]>('pipsuite_visible_columns', ['createdAt', 'type', 'pnl', 'setup', 'outcome', 'tags']);
          setVisibleColumns(cols.filter((col: string) => col !== 'symbol'));
          setColumnsLoaded(true);
      };
      loadColumns();
  }, []);

  useEffect(() => {
    if (columnsLoaded && visibleColumns.length > 0) {
        saveSetting('pipsuite_visible_columns', visibleColumns);
    }
  }, [visibleColumns, columnsLoaded]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (filterDropdownRef.current && filterDropdownRef.current.contains(event.target as Node)) {
              return;
          }
          if ((event.target as Element).closest('button[data-filter-toggle]')) {
              return;
          }
          setOpenFilterColumn(null);
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, []);

  const getCellValue = (trade: Trade, key: ColumnKey | 'symbol'): any => {
      if (key === 'symbol') return trade.symbol;
      if (key === 'rr') {
         if (!trade.entryPrice || !trade.stopLoss || !trade.takeProfit) return 0;
         const risk = Math.abs(trade.entryPrice - trade.stopLoss);
         const reward = Math.abs(trade.takeProfit - trade.entryPrice);
         return risk === 0 ? 0 : reward / risk;
      }
      if (key === 'plannedReward') {
          // 1. Strict USD Preference for filtering
          if (trade.plannedRewardUsd !== undefined && trade.plannedRewardUsd !== null) {
              return trade.plannedRewardUsd;
          }

          // 2. Fallback: If Quote Currency is USD, the Quote Amount IS the USD Amount.
          let isUsdQuote = trade.quoteCurrency === 'USD';
          if (!trade.quoteCurrency) {
              const info = getBaseQuote(trade.symbol);
              if (info && info.quote === 'USD') isUsdQuote = true;
          }

          if (isUsdQuote) {
              // Use stored quote value if available
              if (trade.plannedRewardQuote !== undefined && trade.plannedRewardQuote !== null) {
                  return trade.plannedRewardQuote;
              }
              // Fallback calculation for legacy USD trades
              const asset = ASSETS.find(a => a.assetPair === trade.symbol);
              if (!asset || !trade.entryPrice || !trade.takeProfit || !trade.quantity) return 0;
              const dist = Math.abs(trade.takeProfit - trade.entryPrice);
              return dist * asset.contractSize * trade.quantity;
          }

          // If non-USD pair and no USD conversion stored, return null to exclude from filter to prevent misleading comparisons
          return null;
      }
      if (key === 'partialsCount') return trade.partials ? trade.partials.length : 0;
      if (key === 'partialProfit') return (trade.partials || []).reduce((acc, p) => acc + (p.pnl || 0), 0);
      if (key === 'screenshotsCount') return trade.screenshots ? trade.screenshots.length : 0;
      if (key === 'mainPnl') return trade.mainPnl || 0;
      
      if (key === 'entryTime') return trade.entryDate; 
      if (key === 'exitTime') return trade.exitDate;

      if (key === 'outcome') {
          if (trade.outcome === TradeOutcome.CLOSED) {
              return trade.status; 
          }
          if (trade.outcome === TradeOutcome.MISSED) {
              return 'MISSED';
          }
          return 'OPEN';
      }

      if (key === 'slFilled') {
        if (trade.outcome !== TradeOutcome.CLOSED || !trade.stopLoss || !trade.exitPrice) return 'No';
        const hitSL = trade.type === TradeType.LONG 
            ? trade.exitPrice <= trade.stopLoss 
            : trade.exitPrice >= trade.stopLoss;
        return hitSL ? 'Yes' : 'No';
      }
      if (key === 'tpFilled') {
        if (trade.outcome !== TradeOutcome.CLOSED || !trade.takeProfit || !trade.exitPrice) return 'No';
        const hitTP = trade.type === TradeType.LONG 
            ? trade.exitPrice >= trade.takeProfit 
            : trade.exitPrice <= trade.takeProfit;
        return hitTP ? 'Yes' : 'No';
      }

      // @ts-ignore
      return trade[key];
  };

  const filteredTrades = useMemo(() => {
    const filtered = trades.filter(t => {
        for (const [key, f] of Object.entries(activeFilters)) {
            const filter = f as ColumnFilterState;
            const val = getCellValue(t, key as ColumnKey | 'symbol');

            if (filter.type === 'date') {
                if (!val) return false;
                const dateVal = new Date(val).getTime();
                if (filter.dateFrom && dateVal < new Date(filter.dateFrom).getTime()) return false;
                if (filter.dateTo && dateVal > new Date(filter.dateTo).getTime()) return false;
            } 
            else if (filter.type === 'number') {
                const numVal = parseFloat(val);
                const filterVal = filter.numberValue ? parseFloat(filter.numberValue) : NaN;
                if (isNaN(filterVal)) continue;
                
                // Explicitly fail if value is not a number (e.g. null from getCellValue)
                if (isNaN(numVal)) return false;

                const op = filter.operator || '>';

                switch(op) {
                    case '>': if (!(numVal > filterVal)) return false; break;
                    case '>=': if (!(numVal >= filterVal)) return false; break;
                    case '<': if (!(numVal < filterVal)) return false; break;
                    case '<=': if (!(numVal <= filterVal)) return false; break;
                    case '=': if (Math.abs(numVal - filterVal) > 0.0001) return false; break;
                }
            }
            else if (filter.type === 'tags') {
                if (!filter.selectedTags || filter.selectedTags.length === 0) continue;
                const tradeTags = t.tags || [];
                
                if (filter.tagMatchMode === 'all') {
                    const hasAll = filter.selectedTags.every(tag => tradeTags.includes(tag));
                    if (!hasAll) return false;
                } else {
                    const hasAny = filter.selectedTags.some(tag => tradeTags.includes(tag));
                    if (!hasAny) return false;
                }
            }
            else if (filter.type === 'select') {
                if (!filter.selectedValues || filter.selectedValues.length === 0) continue;
                const strVal = String(val === undefined || val === null ? '' : val);
                if (!filter.selectedValues.includes(strVal)) return false;
            }
            else if (filter.type === 'text') {
                if (!filter.text) continue;
                const strVal = String(val).toLowerCase();
                if (!strVal.includes(filter.text.toLowerCase())) return false;
            }
        }

        return true;
    });

    const safeTime = (value: string | undefined): number | null => {
        if (!value) return null;
        const t = new Date(value).getTime();
        return Number.isFinite(t) ? t : null;
    };

    return filtered.sort((a, b) => {
        const dateA = safeTime(a.createdAt) ?? safeTime(a.entryDate) ?? 0;
        const dateB = safeTime(b.createdAt) ?? safeTime(b.entryDate) ?? 0;
        return dateB - dateA;
    });
  }, [trades, activeFilters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, activeFilters]);

  useEffect(() => {
      if (!isSelectionMode) {
          setSelectedIds(new Set());
      }
  }, [isSelectionMode]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTrades = filteredTrades.slice(startIndex, startIndex + itemsPerPage);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setItemsPerPageInput(e.target.value);
  };

  const applyItemsPerPage = () => {
      let val = parseInt(itemsPerPageInput);
      if (isNaN(val) || val < 5) {
          val = 5;
      }
      setItemsPerPage(val);
      setItemsPerPageInput(val.toString());
  };

  const handleItemsPerPageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
          applyItemsPerPage();
          (e.target as HTMLInputElement).blur();
      }
  };

  const getFilterType = (key: string): ColumnFilterState['type'] | null => {
      if (['createdAt', 'entryDate', 'exitDate', 'entryTime', 'exitTime'].includes(key)) return 'date';
      if (['pnl', 'mainPnl', 'fees', 'quantity', 'entryPrice', 'exitPrice', 'stopLoss', 'takeProfit', 'finalStopLoss', 'finalTakeProfit', 'rr', 'plannedReward', 'partialsCount', 'partialProfit', 'screenshotsCount'].includes(key)) return 'number';
      if (key === 'tags') return 'tags';
      if (['notes', 'emotionalNotes', 'screenshots'].includes(key)) return null; 
      return 'select'; 
  };

  const updateFilter = (key: string, updates: Partial<ColumnFilterState>) => {
      setActiveFilters(prev => {
          const current = prev[key] || { type: getFilterType(key) };
          const newState = { ...current, ...updates };
          
          if (newState.type === 'text' && !newState.text) { const copy = { ...prev }; delete copy[key]; return copy; }
          if (newState.type === 'number' && newState.numberValue === '') { const copy = { ...prev }; delete copy[key]; return copy; }
          if (newState.type === 'tags' && (!newState.selectedTags || newState.selectedTags.length === 0)) { const copy = { ...prev }; delete copy[key]; return copy; }
          if (newState.type === 'select' && (!newState.selectedValues || newState.selectedValues.length === 0)) { const copy = { ...prev }; delete copy[key]; return copy; }
          if (newState.type === 'date' && !newState.dateFrom && !newState.dateTo) { const copy = { ...prev }; delete copy[key]; return copy; }

          return { ...prev, [key]: newState };
      });
  };

  const clearFilter = (key: string) => {
      setActiveFilters(prev => {
          const copy = { ...prev };
          delete copy[key];
          return copy;
      });
      setOpenFilterColumn(null);
  };

  // --- Clear All Filters ---
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  const handleClearAllFilters = () => {
      setActiveFilters({});
      setOpenFilterColumn(null);
  };

  const isFilterActive = (key: string) => !!activeFilters[key];

  const getUniqueColumnValues = (key: string) => {
      const values = new Set<string>();
      trades.forEach(t => {
          const val = getCellValue(t, key as any);
          if (val !== undefined && val !== null && val !== '') {
              values.add(String(val));
          }
      });
      return Array.from(values).sort();
  };

  const getUsedTags = () => {
      const used = new Set<string>();
      trades.forEach(t => t.tags.forEach(tag => used.add(tag)));
      return used;
  };

  const toggleFilterTagGroup = (groupName: string) => {
      const newSet = new Set(expandedFilterTagGroups);
      if (newSet.has(groupName)) {
          newSet.delete(groupName);
      } else {
          newSet.add(groupName);
      }
      setExpandedFilterTagGroups(newSet);
  };

  const handleRowClick = (trade: Trade) => {
      if (isSelectionMode) {
          const newSelected = new Set(selectedIds);
          if (newSelected.has(trade.id)) {
              newSelected.delete(trade.id);
          } else {
              newSelected.add(trade.id);
          }
          setSelectedIds(newSelected);
      } else {
          onTradeClick(trade);
      }
  };

  const toggleSelectAllPage = () => {
      const allPageIds = paginatedTrades.map(t => t.id);
      const allSelected = allPageIds.every(id => selectedIds.has(id));
      
      const newSelected = new Set(selectedIds);
      if (allSelected) {
          allPageIds.forEach(id => newSelected.delete(id));
      } else {
          allPageIds.forEach(id => newSelected.add(id));
      }
      setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
      if (selectedIds.size === 0) return;
      if (onDeleteTrades) {
          onDeleteTrades(Array.from(selectedIds));
      } else {
           Array.from(selectedIds).forEach(id => onDeleteTrade(id));
      }
      setSelectedIds(new Set());
      setIsSelectionMode(false);
  };

  const handleBulkRestore = () => {
      if (selectedIds.size === 0 || !onRestoreTrades) return;
      onRestoreTrades(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
  };

  const handleDragStart = (e: React.DragEvent, colKey: ColumnKey) => {
    if (openFilterColumn) {
        e.preventDefault();
        return;
    }
    setDraggedColumn(colKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedColumn(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent, targetColKey: ColumnKey) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetColKey) return;

    const oldIndex = visibleColumns.indexOf(draggedColumn);
    const newIndex = visibleColumns.indexOf(targetColKey);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newColumns = [...visibleColumns];
      newColumns.splice(oldIndex, 1);
      newColumns.splice(newIndex, 0, draggedColumn);
      setVisibleColumns(newColumns);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const handleExportCSV = () => {
    const dataToExport = isSelectionMode && selectedIds.size > 0 
        ? trades.filter(t => selectedIds.has(t.id)) 
        : filteredTrades;

    exportTradesToCSV(dataToExport);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onImportTrades) return;

      if (!selectedAccountId) {
          alert("Please select a valid account before importing trades.");
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          const text = event.target?.result as string;
          if (!text) return;
          
          const parseCSV = (csvText: string) => {
              const rows: string[][] = [];
              let currentRow: string[] = [];
              let currentVal = '';
              let insideQuotes = false;
              const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

              for (let i = 0; i < normalizedText.length; i++) {
                  const char = normalizedText[i];
                  const nextChar = normalizedText[i + 1];

                  if (char === '"') {
                      if (insideQuotes && nextChar === '"') {
                          currentVal += '"';
                          i++; 
                      } else {
                          insideQuotes = !insideQuotes;
                      }
                  } else if (char === ',' && !insideQuotes) {
                      currentRow.push(currentVal.trim());
                      currentVal = '';
                  } else if (char === '\n' && !insideQuotes) {
                      currentRow.push(currentVal.trim());
                      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== '')) {
                          rows.push(currentRow);
                      }
                      currentRow = [];
                      currentVal = '';
                  } else {
                      currentVal += char;
                  }
              }
              if (currentVal || currentRow.length > 0) {
                  currentRow.push(currentVal.trim());
                  rows.push(currentRow);
              }
              return rows;
          };

          const rows = parseCSV(text);
          if (rows.length < 2) return; 

          // Robust Header Normalization
          const rawHeaders = rows[0];
          const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
          
          const getIndex = (possibleNames: string[]) => {
              const normalizedNames = possibleNames.map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
              return headers.findIndex(h => normalizedNames.includes(h));
          };

          const idx = {
            symbol: getIndex(['assetpair', 'symbol', 'pair', 'ticker']),
            type: getIndex(['direction', 'type', 'side', 'action']),
            createdAt: getIndex(['logtime', 'date', 'createdat', 'opentime']),
            entryPrice: getIndex(['entryprice', 'entry', 'openprice']),
            entryDate: getIndex(['entrytime', 'entrydate', 'opendate']),
            entrySession: getIndex(['entrysession']),
            exitPrice: getIndex(['exitprice', 'exit', 'closeprice']),
            exitDate: getIndex(['exittime', 'exitdate', 'closedate']),
            exitSession: getIndex(['exitsession']),
            stopLoss: getIndex(['stoploss', 'sl', 'entrysl']),
            takeProfit: getIndex(['takeprofit', 'tp', 'entrytp']),
            finalStopLoss: getIndex(['finalstoploss', 'finalsl', 'fsl']),
            finalTakeProfit: getIndex(['finaltakeprofit', 'finaltp', 'ftp']),
            quantity: getIndex(['lotsize', 'quantity', 'size', 'volume']),
            outcome: getIndex(['outcome', 'result']),
            orderType: getIndex(['ordertype']),
            setup: getIndex(['strategy', 'setup']),
            mainPnl: getIndex(['coreprofit', 'corepnl', 'grosspnl']), 
            fees: getIndex(['fees', 'commission', 'swap']),
            pnl: getIndex(['netpnl', 'netpl', 'pnl', 'profit']),
            notes: getIndex(['technicalnotes', 'notes', 'comments']),
            emotionalNotes: getIndex(['emotionalnotes']),
            tags: getIndex(['tags'])
          };

          // Helpers for sanitization
          const normalizeType = (v: string | undefined): TradeType => {
              const s = (v || '').toUpperCase();
              if (s.includes('SHORT') || s.includes('SELL')) return TradeType.SHORT;
              return TradeType.LONG;
          };

          const normalizeOrderType = (v: string | undefined): OrderType => {
              const s = (v || '').toUpperCase();
              if (s.includes('LIMIT')) {
                  if (s.includes('BUY')) return OrderType.BUY_LIMIT;
                  if (s.includes('SELL')) return OrderType.SELL_LIMIT;
              }
              if (s.includes('STOP')) {
                  if (s.includes('BUY')) return OrderType.BUY_STOP;
                  if (s.includes('SELL')) return OrderType.SELL_STOP;
              }
              return OrderType.MARKET;
          };

          const parseTags = (v: string | undefined): string[] => {
              if (!v) return [];
              // Handle both pipe (app standard) and comma (user standard)
              const delimiter = v.includes('|') ? '|' : ',';
              return v.split(delimiter).map(t => t.trim()).filter(Boolean);
          };

          const newTrades: Trade[] = [];
          
          for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              if (row.length < 2) continue; 

              const getValue = (index: number) => {
                  if (index === -1) return undefined;
                  return row[index];
              };

              const outcomeStr = (getValue(idx.outcome) || '').toLowerCase();
              let outcome = TradeOutcome.OPEN;
              let status = TradeStatus.OPEN;

              if (outcomeStr === 'missed') { 
                  outcome = TradeOutcome.MISSED; 
                  status = TradeStatus.MISSED; 
              } else if (outcomeStr === 'open') { 
                  outcome = TradeOutcome.OPEN; 
                  status = TradeStatus.OPEN; 
              } else if (outcomeStr.includes('win') || outcomeStr.includes('loss') || outcomeStr.includes('break') || outcomeStr === 'closed') {
                  outcome = TradeOutcome.CLOSED;
                  if (outcomeStr.includes('win')) status = TradeStatus.WIN;
                  else if (outcomeStr.includes('loss')) status = TradeStatus.LOSS;
                  else if (outcomeStr.includes('break')) status = TradeStatus.BREAK_EVEN;
                  else status = TradeStatus.WIN; 
              }

              const parseDate = (d: string | undefined) => {
                  if (!d) return undefined;
                  // Try ISO first
                  let ts = Date.parse(d);
                  
                  // Try formats like "DD/MM/YYYY" or "MM/DD/YYYY"
                  if (isNaN(ts)) {
                      // Common separators
                      const parts = d.split(/[/\-\.]/);
                      if (parts.length >= 3) {
                          // Assume DD/MM/YYYY first for ambiguity
                          const n1 = parseInt(parts[0]);
                          const n2 = parseInt(parts[1]);
                          const n3 = parseInt(parts[2]);
                          
                          // Heuristic: if n1 > 12, it must be day
                          if (n1 > 12) {
                             ts = new Date(n3, n2 - 1, n1).getTime();
                          } else {
                             // Fallback to MM/DD/YYYY
                             ts = new Date(n3, n1 - 1, n2).getTime();
                          }
                      }
                  }
                  return isNaN(ts) ? undefined : new Date(ts).toISOString();
              };

              const entryDate = parseDate(getValue(idx.entryDate)) || new Date().toISOString();
              const createdAt = parseDate(getValue(idx.createdAt)) || new Date().toISOString();
              const exitDate = parseDate(getValue(idx.exitDate));

              const trade: Trade = {
                  id: generateId('imported'),
                  accountId: selectedAccountId, // Ensure valid account ID
                  symbol: getValue(idx.symbol) || 'UNKNOWN',
                  type: normalizeType(getValue(idx.type)),
                  createdAt: createdAt,
                  entryPrice: parseFloat(getValue(idx.entryPrice) || '0') || 0,
                  entryDate: entryDate,
                  entrySession: getValue(idx.entrySession),
                  exitPrice: getValue(idx.exitPrice) ? parseFloat(getValue(idx.exitPrice)!) : undefined,
                  exitDate: exitDate,
                  exitSession: getValue(idx.exitSession),
                  stopLoss: getValue(idx.stopLoss) ? parseFloat(getValue(idx.stopLoss)!) : undefined,
                  takeProfit: getValue(idx.takeProfit) ? parseFloat(getValue(idx.takeProfit)!) : undefined,
                  finalStopLoss: getValue(idx.finalStopLoss) ? parseFloat(getValue(idx.finalStopLoss)!) : undefined,
                  finalTakeProfit: getValue(idx.finalTakeProfit) ? parseFloat(getValue(idx.finalTakeProfit)!) : undefined,
                  quantity: parseFloat(getValue(idx.quantity) || '0') || 0,
                  outcome: outcome,
                  status: status,
                  orderType: normalizeOrderType(getValue(idx.orderType)),
                  setup: getValue(idx.setup) || '',
                  mainPnl: getValue(idx.mainPnl) ? parseFloat(getValue(idx.mainPnl)!) : undefined,
                  fees: parseFloat(getValue(idx.fees) || '0') || 0,
                  pnl: parseFloat(getValue(idx.pnl) || '0') || 0,
                  notes: getValue(idx.notes) || '',
                  emotionalNotes: getValue(idx.emotionalNotes) || '',
                  tags: parseTags(getValue(idx.tags)),
                  screenshots: [], 
                  partials: [] 
              };
              newTrades.push(trade);
          }

          if (newTrades.length > 0) {
              const processedTrades = newTrades.map(t => {
                  const autoTags = calculateAutoTags({
                      tags: t.tags,
                      type: t.type,
                      entryPrice: t.entryPrice,
                      exitPrice: t.exitPrice,
                      takeProfit: t.takeProfit,
                      stopLoss: t.stopLoss,
                      partials: t.partials
                  });
                  return { ...t, tags: autoTags };
              });

              onImportTrades(processedTrades);
          } else {
              window.alert("No valid trades found in the file.");
          }
      };
      
      reader.readAsText(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderCell = (trade: Trade, key: ColumnKey) => {
    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true
            });
        } catch {
            return '-';
        }
    };

    switch (key) {
      case 'createdAt': return formatDate(trade.createdAt);
      case 'entryTime': return formatDate(trade.entryDate);
      case 'exitTime': return formatDate(trade.exitDate);
      case 'type': return (<span className={`inline-block font-bold text-[10px] ${trade.type === TradeType.LONG ? 'text-profit' : 'text-loss'}`}>{trade.type}</span>);
      case 'outcome':
         if (trade.outcome === TradeOutcome.CLOSED) {
             let statusColor = 'text-textMuted bg-gray-500/10 border-gray-500/20';
             if (trade.status === TradeStatus.WIN) statusColor = 'text-profit bg-profit/10 border-profit/20';
             else if (trade.status === TradeStatus.LOSS) statusColor = 'text-loss bg-loss/10 border-loss/20';
             else if (trade.status === TradeStatus.BREAK_EVEN) statusColor = 'text-textMuted bg-gray-500/10 border-gray-500/20';
             return (<span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`}>{trade.status}</span>);
         }
         return trade.outcome;
      case 'pnl':
      case 'mainPnl':
      case 'partialProfit':
        let val = 0;
        if (key === 'pnl') val = trade.pnl;
        if (key === 'mainPnl') val = trade.mainPnl || 0;
        if (key === 'partialProfit') val = (trade.partials || []).reduce((acc, p) => acc + (p.pnl || 0), 0);
        return (<span className={`font-bold ${val >= 0 ? 'text-profit' : 'text-loss'}`}>{val >= 0 ? '+' : ''}{val.toFixed(2)}</span>);
      case 'slFilled': {
        if (trade.outcome !== TradeOutcome.CLOSED || !trade.stopLoss || !trade.exitPrice) return '-';
        const hitSL = trade.type === TradeType.LONG ? trade.exitPrice <= trade.stopLoss : trade.exitPrice >= trade.stopLoss;
        return hitSL ? <Check size={14} className="text-loss" /> : '-';
      }
      case 'tpFilled': {
        if (trade.outcome !== TradeOutcome.CLOSED || !trade.takeProfit || !trade.exitPrice) return '-';
        const hitTP = trade.type === TradeType.LONG ? trade.exitPrice >= trade.takeProfit : trade.exitPrice <= trade.takeProfit;
        return hitTP ? <Check size={14} className="text-profit" /> : '-';
      }
      case 'rr': {
         if (!trade.entryPrice || !trade.stopLoss || !trade.takeProfit) return '-';
         const risk = Math.abs(trade.entryPrice - trade.stopLoss);
         const reward = Math.abs(trade.takeProfit - trade.entryPrice);
         if (risk === 0) return '-';
         return `1:${(reward / risk).toFixed(2)}`;
      }
      case 'plannedReward': {
          // Use stored values if present to prevent re-render/fetch
          if (trade.plannedRewardQuote !== undefined && trade.plannedRewardQuote !== null) {
              const quote = trade.quoteCurrency || 'USD';
              return (
                  <PlannedMoney 
                      quoteAmount={trade.plannedRewardQuote} 
                      quoteCurrency={quote} 
                      precalculatedUsd={trade.plannedRewardUsd}
                  />
              );
          }

          const assetInfo = getBaseQuote(trade.symbol);
          const asset = ASSETS.find(a => a.assetPair === trade.symbol);
          if (!asset || !assetInfo || !trade.entryPrice || !trade.takeProfit || !trade.quantity) return '-';
          
          const dist = Math.abs(trade.takeProfit - trade.entryPrice);
          const rewardQuote = dist * asset.contractSize * trade.quantity;
          
          return (
              <PlannedMoney 
                  quoteAmount={rewardQuote} 
                  quoteCurrency={assetInfo.quote} 
              />
          );
      }
      case 'partialsCount': return trade.partials ? trade.partials.length.toString() : '0';
      case 'screenshotsCount': return trade.screenshots ? trade.screenshots.length.toString() : '0';
      case 'tags':
         if (!trade.tags || trade.tags.length === 0) return '-';
         return (<div className="flex gap-1">{trade.tags.slice(0, 2).map(tag => (<span key={tag} className="text-[10px] bg-surfaceHighlight border border-border px-1 rounded truncate max-w-[60px]">{tag}</span>))}{trade.tags.length > 2 && <span className="text-[10px] text-textMuted">+{trade.tags.length - 2}</span>}</div>);
      case 'entryPrice':
      case 'exitPrice':
      case 'stopLoss':
      case 'takeProfit':
      case 'finalStopLoss':
      case 'finalTakeProfit':
      case 'fees':
        // @ts-ignore
        return trade[key]?.toLocaleString() || '-';
      default:
        // @ts-ignore
        return trade[key]?.toString() || '-';
    }
  };

  const renderHeader = (colKey: string, label: string, isFixed: boolean = false) => {
      const filterType = getFilterType(colKey);
      const isOpen = openFilterColumn === colKey;
      const isActive = isFilterActive(colKey);
      const currentFilter: Partial<ColumnFilterState> = activeFilters[colKey] || {};

      // Determine dropdown alignment based on column
      const dropdownAlign = colKey === 'symbol' ? 'left-0 origin-top-left' : 'right-0 origin-top-right';

      return (
          <div className="flex items-center justify-between gap-2 h-full">
              <div className="flex items-center gap-2">
                  {!isFixed && <GripVertical size={12} className="text-textMuted/50" />}
                  <div className="truncate">{label}</div>
              </div>
              {filterType && (
                  <div className="relative">
                      <button 
                        data-filter-toggle={colKey}
                        onClick={(e) => { e.stopPropagation(); setOpenFilterColumn(isOpen ? null : colKey); }}
                        className={`p-1 rounded transition-colors ${isActive ? 'bg-primary text-white shadow-sm' : 'hover:bg-surfaceHighlight text-textMuted/50 hover:text-textMain'}`}
                      >
                          <ChevronDown size={12} />
                      </button>
                      {isOpen && (
                          <div ref={filterDropdownRef} className={`absolute top-full ${dropdownAlign} mt-1 w-60 bg-surface border border-border rounded-lg shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 cursor-default`} onClick={(e) => e.stopPropagation()}>
                              <div className="text-xs font-bold mb-2 text-textMain flex justify-between items-center">Filter {label} {isActive && <span className="text-[10px] text-primary">Active</span>}</div>
                              {filterType === 'select' && (
                                  <div className="max-h-48 overflow-y-auto space-y-1">
                                      {getUniqueColumnValues(colKey).map(val => (
                                          <label key={val} className="flex items-center gap-2 hover:bg-surfaceHighlight rounded px-1 py-0.5 cursor-pointer">
                                              <input type="checkbox" checked={currentFilter.selectedValues?.includes(val) || false} onChange={(e) => { const selected = currentFilter.selectedValues || []; e.target.checked ? updateFilter(colKey, { type: 'select', selectedValues: [...selected, val] }) : updateFilter(colKey, { type: 'select', selectedValues: selected.filter(v => v !== val) }); }} className="rounded border-border text-primary focus:ring-primary" />
                                              <span className="text-xs text-textMain truncate" title={val}>{val}</span>
                                          </label>
                                      ))}
                                  </div>
                              )}
                              {filterType === 'number' && (
                                  <div className="flex gap-2">
                                      <select className="bg-background border border-border rounded px-1 py-1.5 text-xs text-textMain w-16" value={currentFilter.operator || '>'} onChange={(e) => updateFilter(colKey, { type: 'number', operator: e.target.value as any })}>
                                          <option value=">">&gt;</option><option value=">=">&ge;</option><option value="<">&lt;</option><option value="<=">&le;</option><option value="=">=</option>
                                      </select>
                                      <input type="number" step="any" className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1.5 text-xs text-textMain" value={currentFilter.numberValue || ''} onChange={(e) => updateFilter(colKey, { type: 'number', numberValue: e.target.value })} placeholder="Value" autoFocus />
                                  </div>
                              )}
                              {filterType === 'date' && (
                                  <div className="space-y-2">
                                      <input type="datetime-local" className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-textMain" value={currentFilter.dateFrom || ''} onChange={(e) => updateFilter(colKey, { type: 'date', dateFrom: e.target.value })} />
                                      <input type="datetime-local" className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-textMain" value={currentFilter.dateTo || ''} onChange={(e) => updateFilter(colKey, { type: 'date', dateTo: e.target.value })} />
                                  </div>
                              )}
                              {filterType === 'tags' && (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    <div className="flex gap-2 mb-2 p-1 bg-surfaceHighlight/50 rounded">
                                        <button onClick={() => updateFilter(colKey, { type: 'tags', tagMatchMode: 'any' })} className={`flex-1 py-1 text-[10px] rounded ${currentFilter.tagMatchMode !== 'all' ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-textMain'}`}>Match Any</button>
                                        <button onClick={() => updateFilter(colKey, { type: 'tags', tagMatchMode: 'all' })} className={`flex-1 py-1 text-[10px] rounded ${currentFilter.tagMatchMode === 'all' ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:text-textMain'}`}>Match All</button>
                                    </div>
                                    {tagGroups.map(group => (
                                        <div key={group.name} className="border border-border/50 rounded overflow-hidden">
                                            <button onClick={() => toggleFilterTagGroup(group.name)} className="w-full flex justify-between items-center p-1.5 bg-surfaceHighlight/30 hover:bg-surfaceHighlight/50 text-[10px] font-bold text-textMuted uppercase tracking-wider">
                                                {group.name} {expandedFilterTagGroups.has(group.name) ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                                            </button>
                                            {expandedFilterTagGroups.has(group.name) && (
                                                <div className="p-1.5 space-y-1">
                                                    {group.tags.map(tag => (
                                                        <label key={tag} className="flex items-center gap-2 hover:bg-surfaceHighlight rounded px-1 py-0.5 cursor-pointer">
                                                            <input type="checkbox" checked={currentFilter.selectedTags?.includes(tag) || false} onChange={(e) => { const selected = currentFilter.selectedTags || []; e.target.checked ? updateFilter(colKey, { type: 'tags', selectedTags: [...selected, tag] }) : updateFilter(colKey, { type: 'tags', selectedTags: selected.filter(t => t !== tag) }); }} className="rounded border-border text-primary focus:ring-primary" />
                                                            <span className="text-xs text-textMain truncate" title={tag}>{tag}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                              )}
                              <div className="mt-3 pt-3 border-t border-border flex justify-end">
                                  <button className="text-xs text-textMuted hover:text-loss transition-colors" onClick={(e) => { e.stopPropagation(); clearFilter(colKey); }}>Clear Filter</button>
                              </div>
                          </div>
                      )}
                  </div>
              )}
          </div>
      );
  };

  if (!columnsLoaded) {
      return (
          <div className="flex h-[300px] w-full items-center justify-center border border-border rounded-xl bg-surface">
              <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={28} />
                  <p className="text-textMuted text-sm font-medium">Loading Journal...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-4 flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-textMain">{isTrash ? 'Trash Bin' : 'Trade Journal'}</h2>
            {hasActiveFilters && (
                <button 
                    onClick={handleClearAllFilters}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-lg text-xs font-medium text-textMuted hover:text-textMain hover:bg-surfaceHighlight transition-colors animate-in fade-in"
                    title="Reset all column filters"
                >
                    <FilterX size={14} /> Clear Filters
                </button>
            )}
        </div>
        <div className="flex gap-2 w-full sm:w-auto items-center">
          {isSelectionMode ? (
              <div className="flex items-center gap-2 bg-surfaceHighlight/50 p-1 rounded-lg border border-primary/30 animate-in fade-in slide-in-from-right-2">
                 <button 
                    onClick={toggleSelectAllPage}
                    className="px-3 py-1.5 text-xs font-medium text-textMain hover:bg-surface rounded transition-colors flex items-center gap-1.5"
                 >
                     <CheckSquare size={14} /> Select All
                 </button>
                 <div className="h-4 w-px bg-border/50"></div>
                 
                 {isTrash && (
                     <button 
                        onClick={handleBulkRestore}
                        className="px-3 py-1.5 text-xs font-medium text-profit hover:bg-profit/10 rounded transition-colors flex items-center gap-1.5"
                        disabled={selectedIds.size === 0}
                     >
                         <RotateCcw size={14} /> Restore ({selectedIds.size})
                     </button>
                 )}

                 <button 
                     onClick={handleBulkDelete}
                     className="px-3 py-1.5 text-xs font-medium text-loss hover:bg-loss/10 rounded transition-colors flex items-center gap-1.5"
                     disabled={selectedIds.size === 0}
                 >
                     <Trash2 size={14} /> {isTrash ? 'Delete Forever' : 'Delete'} ({selectedIds.size})
                 </button>
                 
                 {!isTrash && (
                    <>
                        <div className="h-4 w-px bg-border/50"></div>
                        <button 
                            onClick={handleExportCSV}
                            className="px-3 py-1.5 text-xs font-medium text-textMuted hover:text-textMain hover:bg-surface rounded transition-colors flex items-center gap-1.5"
                            disabled={selectedIds.size === 0}
                        >
                            <Download size={14} /> Export ({selectedIds.size})
                        </button>
                    </>
                 )}
                 
                 <div className="h-4 w-px bg-border/50"></div>
                 <button 
                    onClick={() => setIsSelectionMode(false)}
                    className="p-1.5 text-textMuted hover:text-textMain hover:bg-surface rounded transition-colors"
                    title="Exit Selection Mode"
                 >
                    <X size={14} />
                 </button>
              </div>
          ) : (
              <div className="flex gap-2 mr-auto sm:mr-0 order-2 sm:order-1">
                <button 
                    onClick={() => setIsSelectionMode(true)}
                    className="bg-surface border border-border px-3 py-2 rounded-lg text-textMuted hover:text-primary flex items-center gap-2 text-xs transition-colors"
                    title="Select Rows"
                >
                    <MousePointer2 size={14} /> <span className="hidden lg:inline">Select</span>
                </button>
                {onImportTrades && !isTrash && (
                    <>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".csv"
                            onChange={handleImportCSV}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-surface border border-border px-3 py-2 rounded-lg text-textMuted hover:text-textMain flex items-center gap-2 text-xs transition-colors"
                            title="Import CSV"
                        >
                            <Upload size={14} /> <span className="hidden lg:inline">Import</span>
                        </button>
                    </>
                )}
                {!isTrash && (
                    <button 
                        onClick={handleExportCSV}
                        className="bg-surface border border-border px-3 py-2 rounded-lg text-textMuted hover:text-textMain flex items-center gap-2 text-xs transition-colors"
                        title="Export All Columns"
                    >
                        <Download size={14} /> <span className="hidden lg:inline">Export</span>
                    </button>
                )}
              </div>
          )}
          <button onClick={() => setIsColumnModalOpen(true)} className="bg-surface border border-border px-3 py-2 rounded-lg text-textMuted hover:text-textMain flex items-center gap-2 text-xs order-3"><Settings size={14} /> Columns</button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className={`overflow-auto transition-all duration-200 ${openFilterColumn ? 'min-h-[350px]' : ''}`} style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="min-w-full text-left text-sm border-collapse">
            <thead className="bg-surfaceHighlight text-textMuted border-b border-border">
              <tr>
                {isSelectionMode && <th className="sticky left-0 top-0 z-50 w-[40px] px-4 py-3 bg-surfaceHighlight border-r border-border/50 text-center"><CheckSquare size={14} /></th>}
                <th className={`sticky top-0 z-50 w-[50px] px-4 py-3 font-medium text-xs uppercase tracking-wider text-left bg-surfaceHighlight border-r border-border/50 ${isSelectionMode ? 'left-[40px]' : 'left-0'}`}>No.</th>
                <th className={`sticky top-0 z-50 min-w-[100px] px-4 py-3 font-medium text-xs uppercase tracking-wider text-left bg-surfaceHighlight border-r border-border/50 ${isSelectionMode ? 'left-[90px]' : 'left-[50px]'}`}>{renderHeader('symbol', 'Asset Pair', true)}</th>
                {visibleColumns.map(colKey => {
                  const colDef = AVAILABLE_COLUMNS.find(c => c.key === colKey) || { label: colKey };
                  const isDragging = draggedColumn === colKey;
                  return (
                    <th key={colKey} className={`sticky top-0 z-40 px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap min-w-[90px] max-w-[300px] text-left cursor-move hover:bg-surfaceHighlight/80 transition-colors select-none bg-surfaceHighlight ${isDragging ? 'opacity-30' : ''}`} draggable={!openFilterColumn} onDragStart={(e) => handleDragStart(e, colKey)} onDragOver={handleDragOver} onDragEnter={(e) => handleDragEnter(e, colKey)} onDragEnd={handleDragEnd} onDrop={handleDrop}>
                      {renderHeader(colKey, colDef.label)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedTrades.map((trade, idx) => {
                const isSelected = selectedIds.has(trade.id);
                return (
                    <tr key={trade.id} onClick={() => handleRowClick(trade)} className={`transition-colors cursor-pointer group ${isSelected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-surfaceHighlight'} ${isTrash ? 'opacity-70 grayscale-[30%]' : ''}`}>
                    {isSelectionMode && <td className={`sticky left-0 z-30 px-4 py-3 border-r border-border/50 text-center transition-colors ${isSelected ? 'bg-primary/10 group-hover:bg-primary/20' : 'bg-surface group-hover:bg-surfaceHighlight'}`}><div className={`w-4 h-4 rounded border flex items-center justify-center mx-auto transition-colors ${isSelected ? 'bg-primary border-primary text-white' : 'border-textMuted/50 bg-background'}`}>{isSelected && <Check size={10} strokeWidth={4} />}</div></td>}
                    <td className={`sticky z-30 w-[50px] px-4 py-3 text-sm text-textMuted border-r border-border/50 transition-colors ${isSelectionMode ? 'left-[40px]' : 'left-0'} ${isSelected ? 'bg-primary/10 group-hover:bg-primary/20' : 'bg-surface group-hover:bg-surfaceHighlight'}`}>{startIndex + idx + 1}</td>
                    <td className={`sticky z-30 min-w-[100px] px-4 py-3 text-sm font-bold text-textMain border-r border-border/50 transition-colors ${isSelectionMode ? 'left-[90px]' : 'left-[50px]'} ${isSelected ? 'bg-primary/10 group-hover:bg-primary/20' : 'bg-surface group-hover:bg-surfaceHighlight'}`}>{trade.symbol}</td>
                    {visibleColumns.map(colKey => <td key={colKey} className="px-4 py-3 whitespace-nowrap text-sm min-w-[90px] max-w-[300px] text-left z-0"><div className="truncate" title={typeof trade[colKey as keyof Trade] === 'string' ? trade[colKey as keyof Trade] as string : undefined}>{renderCell(trade, colKey)}</div></td>)}
                    </tr>
                );
              })}
              {filteredTrades.length === 0 && (<tr><td colSpan={visibleColumns.length + (isSelectionMode ? 3 : 2)} className="p-12 text-center text-textMuted text-sm">{isTrash ? "Trash is empty." : "No trades match your criteria."}</td></tr>)}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 border-t border-border bg-surface flex flex-col sm:flex-row justify-between items-center gap-4 text-xs shrink-0">
           <div className="flex items-center gap-4"><span className="text-textMuted hidden sm:inline">Showing {Math.min(startIndex + 1, filteredTrades.length)} - {Math.min(startIndex + itemsPerPage, filteredTrades.length)} of {filteredTrades.length} trades</span>
              <div className="flex items-center gap-2"><span className="text-textMuted">Rows:</span><input type="number" min="5" value={itemsPerPageInput} onChange={handleItemsPerPageChange} onBlur={applyItemsPerPage} onKeyDown={handleItemsPerPageKeyDown} className="w-12 bg-surfaceHighlight border border-border rounded px-1.5 py-1 text-center focus:outline-none focus:border-primary" /></div>
           </div>
           <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 rounded-md text-textMuted hover:bg-surfaceHighlight hover:text-textMain disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft size={16} /></button>
              <div className="flex items-center gap-1 px-2">{Array.from({ length: Math.min(totalPages, 7) }).map((_, idx) => { let pageNum = idx + 1; if (totalPages > 7) { if (currentPage > 4) { pageNum = currentPage - 3 + idx; } if (pageNum > totalPages) return null; } return (<button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-7 h-7 flex items-center justify-center rounded-md font-medium transition-colors ${currentPage === pageNum ? 'bg-primary text-white shadow-sm' : 'text-textMuted hover:bg-surfaceHighlight hover:text-textMain'}`}>{pageNum}</button>) })}</div>
              <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-1.5 rounded-md text-textMuted hover:bg-surfaceHighlight hover:text-textMain disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight size={16} /></button>
           </div>
        </div>
      </div>

      {isColumnModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setIsColumnModalOpen(false)}>
          <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex justify-between items-center"><h3 className="font-bold text-sm">Select Columns</h3><button onClick={() => setIsColumnModalOpen(false)}><X size={16} className="text-textMuted" /></button></div>
            <div className="p-4 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">{AVAILABLE_COLUMNS.map((col) => { return (<label key={col.key} className="flex items-center gap-2 p-2 rounded hover:bg-surfaceHighlight cursor-pointer"><input type="checkbox" checked={visibleColumns.includes(col.key)} onChange={() => toggleColumn(col.key)} className="rounded border-border bg-background text-primary focus:ring-primary" /><span className="text-xs">{col.label}</span></label>) })}</div>
            <div className="p-4 border-t border-border flex justify-end"><button onClick={() => setIsColumnModalOpen(false)} className="px-4 py-2 bg-primary text-white rounded text-xs font-medium">Done</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeList;
