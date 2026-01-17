
import { Trade, AVAILABLE_COLUMNS, ColumnKey, ASSETS, TradeOutcome, TradeType } from '../types';

export const exportTradesToCSV = (trades: Trade[]) => {
    if (trades.length === 0) return;

    const headers = ["Asset Pair", ...AVAILABLE_COLUMNS.map(c => c.label)];
    const keys = ["symbol", ...AVAILABLE_COLUMNS.map(c => c.key)];

    // Helper to get raw values for export (avoiding JSX from UI renderers)
    const getExportValue = (trade: Trade, key: ColumnKey | 'symbol'): any => {
        if (key === 'symbol') return trade.symbol;
        
        // Calculated Numeric Fields
        if (key === 'rr') {
             if (!trade.entryPrice || !trade.stopLoss || !trade.takeProfit) return 0;
             const risk = Math.abs(trade.entryPrice - trade.stopLoss);
             const reward = Math.abs(trade.takeProfit - trade.entryPrice);
             return risk === 0 ? 0 : (reward / risk).toFixed(2);
        }
        if (key === 'plannedReward') {
            const asset = ASSETS.find(a => a.assetPair === trade.symbol);
            if (!asset || !trade.entryPrice || !trade.takeProfit || !trade.quantity) return 0;
            const dist = Math.abs(trade.takeProfit - trade.entryPrice);
            return (dist * asset.contractSize * trade.quantity).toFixed(2);
        }
        if (key === 'partialsCount') return trade.partials ? trade.partials.length : 0;
        if (key === 'partialProfit') return (trade.partials || []).reduce((acc, p) => acc + (p.pnl || 0), 0).toFixed(2);
        if (key === 'screenshotsCount') return trade.screenshots ? trade.screenshots.length : 0;
        
        // Status/Enums
        if (key === 'outcome') {
            if (trade.outcome === TradeOutcome.CLOSED) return trade.status;
            if (trade.outcome === TradeOutcome.MISSED) return 'MISSED';
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

        // Direct Property Access
        // @ts-ignore
        return trade[key];
    };

    const csvContent = [
        headers.join(','),
        ...trades.map(row => {
            return keys.map(k => {
                let val: any;
                // Prefer raw numbers for specific fields to avoid formatting issues
                const numericKeys = ['entryPrice', 'exitPrice', 'stopLoss', 'takeProfit', 'finalStopLoss', 'finalTakeProfit', 'quantity', 'fees', 'mainPnl', 'pnl'];
                
                if (k !== 'symbol' && numericKeys.includes(k as string)) {
                    // @ts-ignore
                    val = row[k];
                    if (val === undefined || val === null) val = '';
                } else {
                    val = getExportValue(row, k as ColumnKey);
                }
                
                if (val === null || val === undefined) return '';
                
                // Handle arrays (tags, etc)
                if (Array.isArray(val)) {
                    val = val.join('|');
                }

                const strVal = String(val);
                // Escape quotes and handle commas
                if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
                    return `"${strVal.replace(/"/g, '""')}"`;
                }
                return strVal;
            }).join(',');
        })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
};
