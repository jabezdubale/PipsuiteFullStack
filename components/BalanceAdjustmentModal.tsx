
import React, { useState } from 'react';
import { X, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

interface BalanceAdjustmentModalProps {
  currentBalance: number;
  onConfirm: (amount: number, type: 'deposit' | 'withdraw') => void;
  onClose: () => void;
}

const BalanceAdjustmentModal: React.FC<BalanceAdjustmentModalProps> = ({ currentBalance, onConfirm, onClose }) => {
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    if (type === 'withdraw' && val > currentBalance) {
        alert("Insufficient funds");
        return;
    }

    onConfirm(val, type);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-bold">Manage Balance</h3>
          <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          <div className="flex bg-surfaceHighlight p-1 rounded-lg">
             <button
                type="button"
                onClick={() => setType('deposit')}
                className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${
                    type === 'deposit' ? 'bg-background shadow text-profit' : 'text-textMuted hover:text-textMain'
                }`}
             >
                <ArrowDownLeft size={16} /> Deposit
             </button>
             <button
                type="button"
                onClick={() => setType('withdraw')}
                className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${
                    type === 'withdraw' ? 'bg-background shadow text-loss' : 'text-textMuted hover:text-textMain'
                }`}
             >
                <ArrowUpRight size={16} /> Withdraw
             </button>
          </div>

          <div className="text-center">
             <p className="text-xs text-textMuted uppercase mb-1">Current Balance</p>
             <p className="text-2xl font-bold">${currentBalance.toLocaleString()}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-1">Amount</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted">$</span>
                <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-8 pr-4 py-3 text-lg font-bold text-textMain focus:ring-1 focus:ring-primary outline-none"
                placeholder="0.00"
                min="0"
                step="any"
                required 
                />
            </div>
          </div>

          <button 
            type="submit" 
            className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 ${
                type === 'deposit' ? 'bg-profit hover:bg-green-600' : 'bg-loss hover:bg-red-600'
            }`}
          >
             Confirm {type === 'deposit' ? 'Deposit' : 'Withdrawal'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default BalanceAdjustmentModal;
