
import { ASSETS, TradeType, OrderType } from '../types';
import { getBaseQuote } from './symbol';

export interface TradeMetrics {
  direction: string; // 'LONG' | 'SHORT' | '-'
  orderTypeLabel: string;
  
  riskQuote: number;
  riskUSD: number | null;
  
  rewardQuote: number;
  rewardUSD: number | null;
  
  rr: number;
  
  marginQuote: number;
  marginUSD: number | null;
  
  // Distance metrics
  tpPoints: number;
  tpPips: number;
  slPoints: number;
  slPips: number;
  
  validationErrors: string[];
  isValid: boolean;
  needsSlTpForValidation: boolean;
  
  quoteCurrency: string;
}

export const calculateRiskPercentage = (
    entry: number, 
    sl: number, 
    quantity: number, 
    symbol: string, 
    balance: number, 
    fxRate: number | null
): number => {
    const asset = ASSETS.find(a => a.assetPair === symbol);
    if (!asset || isNaN(entry) || isNaN(sl) || isNaN(quantity) || isNaN(balance) || balance === 0 || fxRate === null) return 0;
    
    const dist = Math.abs(entry - sl);
    const riskQuote = dist * asset.contractSize * quantity;
    const riskUSD = riskQuote * fxRate;
    
    return (riskUSD / balance) * 100;
};

export const calculateQuantity = (
    entry: number, 
    sl: number, 
    riskPercentage: number, 
    symbol: string, 
    balance: number, 
    fxRate: number | null
): number => {
    const asset = ASSETS.find(a => a.assetPair === symbol);
    if (!asset || isNaN(entry) || isNaN(sl) || isNaN(riskPercentage) || isNaN(balance) || fxRate === null || fxRate === 0) return 0;
    
    const riskUSD = balance * (riskPercentage / 100);
    const riskQuote = riskUSD / fxRate;
    const dist = Math.abs(entry - sl);
    
    if (dist === 0) return 0;
    
    return riskQuote / (dist * asset.contractSize);
};

export const computePlannedValuesForSave = (
    form: {
        symbol: string;
        entryPrice: number | string;
        stopLoss?: number | string;
        takeProfit?: number | string;
        quantity: number | string;
    },
    fxRate: number | null
) => {
    const asset = ASSETS.find(a => a.assetPair === form.symbol);
    const quoteInfo = getBaseQuote(form.symbol);
    const quoteCurrency = quoteInfo ? quoteInfo.quote : 'USD';
    const isUsd = quoteCurrency === 'USD';
    
    // Default rate to 1 if USD, otherwise use provided rate (or null if missing)
    const finalFxRate = isUsd ? 1 : fxRate;

    const entry = parseFloat(String(form.entryPrice));
    const sl = parseFloat(String(form.stopLoss));
    const tp = parseFloat(String(form.takeProfit));
    const qty = parseFloat(String(form.quantity));

    let plannedRiskQuote: number | null = null;
    let plannedRewardQuote: number | null = null;
    let plannedRiskUsd: number | null = null;
    let plannedRewardUsd: number | null = null;

    if (asset && !isNaN(entry) && !isNaN(qty)) {
        if (!isNaN(sl)) {
            const riskDist = Math.abs(entry - sl);
            plannedRiskQuote = riskDist * asset.contractSize * qty;
            if (finalFxRate !== null) {
                plannedRiskUsd = plannedRiskQuote * finalFxRate;
            }
        }
        if (!isNaN(tp)) {
            const rewardDist = Math.abs(tp - entry);
            plannedRewardQuote = rewardDist * asset.contractSize * qty;
            if (finalFxRate !== null) {
                plannedRewardUsd = plannedRewardQuote * finalFxRate;
            }
        }
    }

    return {
        quoteCurrency,
        fxRateToUsd: finalFxRate,
        plannedRiskQuote,
        plannedRewardQuote,
        plannedRiskUsd,
        plannedRewardUsd
    };
};

export const computeTradeMetrics = (
  form: {
    symbol: string;
    entryPrice: string;
    takeProfit: string;
    stopLoss: string;
    quantity: string;
    leverage: string;
    currentPrice: string;
    balance: string;
    riskPercentage: string;
  },
  fxRateToUSD: number | null
): TradeMetrics => {
  const result: TradeMetrics = {
    direction: '-',
    orderTypeLabel: 'Market',
    riskQuote: 0,
    riskUSD: null,
    rewardQuote: 0,
    rewardUSD: null,
    rr: 0,
    marginQuote: 0,
    marginUSD: null,
    tpPoints: 0,
    tpPips: 0,
    slPoints: 0,
    slPips: 0,
    validationErrors: [],
    isValid: true,
    needsSlTpForValidation: false,
    quoteCurrency: 'USD'
  };

  const asset = ASSETS.find(a => a.assetPair === form.symbol);
  if (!asset) return result;

  const quoteInfo = getBaseQuote(form.symbol);
  result.quoteCurrency = quoteInfo ? quoteInfo.quote : 'USD';

  const entry = parseFloat(form.entryPrice);
  const tp = parseFloat(form.takeProfit);
  const sl = parseFloat(form.stopLoss);
  const qty = parseFloat(form.quantity);
  const lev = parseFloat(form.leverage) || 1;
  const current = parseFloat(form.currentPrice);

  if (isNaN(entry)) return result;

  // 1. Determine Direction & Validation
  let direction: TradeType | null = null;
  const hasTP = !isNaN(tp);
  const hasSL = !isNaN(sl);

  if (hasTP && hasSL) {
      if (tp > entry && sl < entry) direction = TradeType.LONG;
      else if (tp < entry && sl > entry) direction = TradeType.SHORT;
      else {
          // Invalid combination
          result.validationErrors.push("Invalid TP/SL for direction. TP and SL imply opposite directions.");
          result.isValid = false;
      }
  } else if (hasTP) {
      direction = tp > entry ? TradeType.LONG : TradeType.SHORT;
      result.needsSlTpForValidation = true;
  } else if (hasSL) {
      direction = sl < entry ? TradeType.LONG : TradeType.SHORT;
      result.needsSlTpForValidation = true;
  }

  if (direction) {
      result.direction = direction;
  } else {
      if (hasTP || hasSL) {
          // Case where logic failed above or edge case (Entry == TP/SL)
          if (result.isValid) result.validationErrors.push("Cannot determine direction from Price levels.");
      }
  }

  // 2. Order Type Label
  if (!isNaN(current) && direction) {
      if (direction === TradeType.LONG) {
          if (entry < current) result.orderTypeLabel = 'Buy Limit';
          else if (entry > current) result.orderTypeLabel = 'Buy Stop';
          else result.orderTypeLabel = 'Market Buy';
      } else {
          if (entry > current) result.orderTypeLabel = 'Sell Limit';
          else if (entry < current) result.orderTypeLabel = 'Sell Stop';
          else result.orderTypeLabel = 'Market Sell';
      }
  } else if (direction) {
      result.orderTypeLabel = direction === TradeType.LONG ? 'Market Buy' : 'Market Sell';
  }

  // 3. Math Calculations
  const calculateDist = (target: number) => {
      if (isNaN(target)) return { points: 0, pips: 0 };
      const dist = Math.abs(target - entry);
      return {
          points: dist,
          pips: dist / asset.pip
      };
  };

  const tpCalc = calculateDist(tp);
  const slCalc = calculateDist(sl);

  result.tpPoints = tpCalc.points;
  result.tpPips = tpCalc.pips;
  result.slPoints = slCalc.points;
  result.slPips = slCalc.pips;

  const validRate = (result.quoteCurrency === 'USD') ? 1 : fxRateToUSD;

  if (!isNaN(qty)) {
      // Risk
      if (hasSL) {
          result.riskQuote = slCalc.points * asset.contractSize * qty;
          if (validRate !== null) {
              result.riskUSD = result.riskQuote * validRate;
          }
      }

      // Reward
      if (hasTP) {
          result.rewardQuote = tpCalc.points * asset.contractSize * qty;
          if (validRate !== null) {
              result.rewardUSD = result.rewardQuote * validRate;
          }
      }

      // Margin
      if (entry > 0) {
          result.marginQuote = (entry * asset.contractSize * qty) / lev;
          if (validRate !== null) {
              result.marginUSD = result.marginQuote * validRate;
          }
      }
  }

  // RR
  if (result.riskQuote > 0) {
      result.rr = result.rewardQuote / result.riskQuote;
  }

  return result;
};
