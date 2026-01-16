
import { TradeType, TradePartial } from '../types';

interface AutoTagParams {
    tags: string[];
    type: TradeType;
    entryPrice: number;
    exitPrice?: number;
    takeProfit?: number;
    stopLoss?: number;
    partials?: TradePartial[];
}

export const calculateAutoTags = (params: AutoTagParams): string[] => {
    const { tags, type, entryPrice, exitPrice, takeProfit, stopLoss, partials } = params;
    
    // Use a Set to handle uniqueness easily
    const currentTags = new Set(tags);

    // Helper to add/remove
    const setTag = (tagName: string, shouldExist: boolean) => {
        if (shouldExist) currentTags.add(tagName);
        else currentTags.delete(tagName);
    };

    // 1. #Partial Logic
    const hasPartials = partials && partials.length > 0;
    setTag('#Partial', hasPartials);

    // If no exit price, we can't calculate execution tags (TP, SL, BE, etc.)
    // We only return the partials update.
    if (exitPrice === undefined || exitPrice === null || isNaN(exitPrice)) {
        return Array.from(currentTags);
    }

    // Comparison tolerance for floats (optional, but inequality is primary)
    const isEq = (a: number, b: number) => Math.abs(a - b) < 0.00001;

    // 2. #TP (Touched or Crossed Take Profit)
    let hitTP = false;
    if (takeProfit !== undefined) {
        if (type === TradeType.LONG) {
            hitTP = exitPrice >= takeProfit;
        } else {
            hitTP = exitPrice <= takeProfit;
        }
    }
    setTag('#TP', hitTP);

    // 3. #SL (Touched or Crossed Stop Loss)
    let hitSL = false;
    if (stopLoss !== undefined) {
        if (type === TradeType.LONG) {
            hitSL = exitPrice <= stopLoss;
        } else {
            hitSL = exitPrice >= stopLoss;
        }
    }
    setTag('#SL', hitSL);

    // 4. #Break-Even (Exit == Entry)
    const hitBE = isEq(exitPrice, entryPrice);
    setTag('#Break-Even', hitBE);

    // 5. #Early-Exit (Between Entry and TP)
    let isEarly = false;
    if (takeProfit !== undefined) {
        if (type === TradeType.LONG) {
            // Entry < Exit < TP
            isEarly = exitPrice > entryPrice && exitPrice < takeProfit;
        } else {
            // Entry > Exit > TP
            isEarly = exitPrice < entryPrice && exitPrice > takeProfit;
        }
    }
    setTag('#Early-Exit', isEarly);

    // 6. #Late-Chased (Better than TP)
    // Long: Exit > TP
    // Short: Exit < TP
    let isLate = false;
    if (takeProfit !== undefined) {
        if (type === TradeType.LONG) {
            isLate = exitPrice > takeProfit;
        } else {
            isLate = exitPrice < takeProfit;
        }
    }
    setTag('#Late-Chased', isLate);

    return Array.from(currentTags);
};
