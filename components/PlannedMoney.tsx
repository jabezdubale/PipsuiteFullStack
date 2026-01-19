
import React, { useState, useEffect } from 'react';
import { getFxRateToUSD } from '../services/fxService';

interface PlannedMoneyProps {
    quoteAmount: number;
    quoteCurrency: string;
    showUsdOnly?: boolean;
    className?: string;
    precalculatedUsd?: number | null;
}

const PlannedMoney: React.FC<PlannedMoneyProps> = ({ quoteAmount, quoteCurrency, showUsdOnly, className = '', precalculatedUsd }) => {
    const [usdAmount, setUsdAmount] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        
        // If we have a precalculated value, use it directly and skip fetch
        if (precalculatedUsd !== undefined) {
            setUsdAmount(precalculatedUsd);
            return;
        }

        // Reset to null if no precalculated value provided (fetching state)
        setUsdAmount(null);

        if (quoteCurrency === 'USD') {
            setUsdAmount(quoteAmount);
            return;
        }
        
        // Fetch rate from service (uses cache internally)
        getFxRateToUSD(quoteCurrency).then(rate => {
            if (cancelled) return;
            if (rate !== null) {
                setUsdAmount(quoteAmount * rate);
            }
        });
        
        return () => { cancelled = true; };
    }, [quoteAmount, quoteCurrency, precalculatedUsd]);

    // Case 1: USD Base (e.g. EURUSD) or Explicit override
    if (quoteCurrency === 'USD') {
        return <span className={className}>${quoteAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
    }

    // Case 2: Show USD Only (e.g. Close Modal Target)
    if (showUsdOnly) {
        return <span className={className}>{usdAmount !== null ? `$${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</span>;
    }

    // Case 3: Show Quote + USD Subtitle (e.g. Journal, Detail)
    return (
        <div className={`flex flex-col leading-tight ${className}`}>
            <span>{quoteAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[0.9em] opacity-70">{quoteCurrency}</span></span>
            {usdAmount !== null && (
                <span className="text-[0.8em] text-textMuted font-normal">
                    ${usdAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            )}
        </div>
    );
};

export default PlannedMoney;
