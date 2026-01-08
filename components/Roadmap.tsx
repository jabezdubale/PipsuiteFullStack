import React from 'react';
import { CheckCircle, Circle, XCircle } from 'lucide-react';

const Roadmap = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-textMain mb-2">Feature Discussion</h2>
        <p className="text-textMuted">
            You asked to discuss which features to build and which to leave out. 
            Here is the breakdown of a typical "TradeZella" clone strategy for a solo developer.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Core MVP */}
        <div className="bg-surface border border-border rounded-xl p-6">
          <h3 className="text-xl font-bold text-profit mb-4 flex items-center gap-2">
            <CheckCircle size={20} /> Built (The Essentials)
          </h3>
          <ul className="space-y-3">
            <li className="flex gap-3 text-textMain">
                <span className="text-textMuted w-6">1.</span>
                <div>
                    <strong>Journal & Tracking:</strong> The core ability to log Entry, Exit, Price, Quantity, and Setup.
                    <p className="text-xs text-textMuted mt-1">Status: Implemented via LocalStorage.</p>
                </div>
            </li>
            <li className="flex gap-3 text-textMain">
                <span className="text-textMuted w-6">2.</span>
                <div>
                    <strong>Dashboard Analytics:</strong> Win Rate, Profit Factor, and Net P&L.
                    <p className="text-xs text-textMuted mt-1">Status: Implemented with Recharts.</p>
                </div>
            </li>
             <li className="flex gap-3 text-textMain">
                <span className="text-textMuted w-6">3.</span>
                <div>
                    <strong>AI Analysis (Zella Clone):</strong> Using LLMs to give feedback.
                    <p className="text-xs text-textMuted mt-1">Status: Implemented via Gemini API.</p>
                </div>
            </li>
          </ul>
        </div>

        {/* Phase 2 */}
        <div className="bg-surface border border-border rounded-xl p-6 opacity-75">
          <h3 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
            <Circle size={20} /> Build Next (High Value)
          </h3>
          <ul className="space-y-3">
            <li className="flex gap-3 text-textMain">
                <span className="text-textMuted w-6">1.</span>
                <div>
                    <strong>Calendar Heatmap:</strong> A monthly view showing green/red days. 
                    <p className="text-xs text-textMuted mt-1">Reason: Highly visual motivational tool.</p>
                </div>
            </li>
            <li className="flex gap-3 text-textMain">
                <span className="text-textMuted w-6">2.</span>
                <div>
                    <strong>Playbooks:</strong> A section to define your strategies with rules.
                    <p className="text-xs text-textMuted mt-1">Reason: Helps with discipline before taking the trade.</p>
                </div>
            </li>
          </ul>
        </div>

        {/* Leave Out */}
        <div className="bg-surface border border-border rounded-xl p-6 opacity-50">
          <h3 className="text-xl font-bold text-loss mb-4 flex items-center gap-2">
            <XCircle size={20} /> Leave Out (Too Complex/Expensive)
          </h3>
          <ul className="space-y-3">
            <li className="flex gap-3 text-textMain">
                <span className="text-textMuted w-6">1.</span>
                <div>
                    <strong>Broker Sync / Auto-Import:</strong> Connecting to MetaTrader/cTrader APIs.
                    <p className="text-xs text-textMuted mt-1">Reason: Extremely difficult to maintain, requires expensive 3rd party APIs (like SnapTrade) and backend security.</p>
                </div>
            </li>
            <li className="flex gap-3 text-textMain">
                <span className="text-textMuted w-6">2.</span>
                <div>
                    <strong>Market Replay:</strong> Replaying historical candle data.
                    <p className="text-xs text-textMuted mt-1">Reason: Requires massive historical data storage and complex canvas rendering.</p>
                </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Roadmap;
