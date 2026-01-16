
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

    // 2. #Break-Even (Exit is very close to Entry)
    // Tolerance: 0.01% of entry price (handles slight slippage or spread costs at BE)
    const tolerance = entryPrice * 0.0001;
    const isBE = Math.abs(exitPrice - entryPrice) <= tolerance;
    setTag('#Break-Even', isBE);

    // 3. #TP & #SL & Early/Late Logic
    let hitTP = false;
    let hitSL = false;
    let isEarly = false;
    let isLate = false;

    if (type === TradeType.LONG) {
        if (takeProfit !== undefined) {
            // Hit TP if exit is at or above TP (Inequality for slippage)
            hitTP = exitPrice >= takeProfit;
            
            // Early Exit: Profitable (above entry) but below TP, and not BE
            if (exitPrice > entryPrice && exitPrice < takeProfit && !isBE) {
                isEarly = true;
            }
            
            // Late Chased / Runner (Better than TP): Exit > TP
            if (exitPrice > takeProfit) {
                isLate = true;
            }
        }
        if (stopLoss !== undefined) {
            // Hit SL if exit is at or below SL
            hitSL = exitPrice <= stopLoss;
        }
    } else { // SHORT
        if (takeProfit !== undefined) {
            // Hit TP if exit is at or below TP
            hitTP = exitPrice <= takeProfit;
            
            // Early Exit: Profitable (below entry) but above TP
            if (exitPrice < entryPrice && exitPrice > takeProfit && !isBE) {
                isEarly = true;
            }

            // Late Chased / Runner (Better than TP): Exit < TP
            if (exitPrice < takeProfit) {
                isLate = true;
            }
        }
        if (stopLoss !== undefined) {
            // Hit SL if exit is at or above SL
            hitSL = exitPrice >= stopLoss;
        }
    }

    // Apply tags based on logic
    // Note: If isBE is true, usually we don't want TP/SL tags unless TP/SL were effectively at entry.
    // Logic below prioritizes the specific outcome flags.
    
    setTag('#TP', hitTP);
    setTag('#SL', hitSL);
    setTag('#Early-Exit', isEarly);
    setTag('#Late-Chased', isLate);

    return Array.from(currentTags);
};
