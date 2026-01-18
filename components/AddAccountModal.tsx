
import React, { useState } from 'react';
import { Account } from '../types';
import { generateId } from '../utils/idUtils';
import { X, Save, Check } from 'lucide-react';

interface AddAccountModalProps {
  onSave: (account: Account) => void;
  onClose: () => void;
  userId: string;
}

const AddAccountModal: React.FC<AddAccountModalProps> = ({ onSave, onClose, userId }) => {
  const [formData, setFormData] = useState<Partial<Account>>({
    name: '',
    currency: 'USD',
    balance: '' as any, // Initialize as empty string
    type: 'Real'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    const newAccount: Account = {
      id: generateId('acc'),
      userId: userId, // Link to current user
      name: formData.name,
      currency: 'USD', // Enforce USD
      balance: Number(formData.balance) || 0,
      isDemo: formData.type === 'Demo',
      type: formData.type as 'Real' | 'Demo' | 'Funded'
    };

    onSave(newAccount);
    onClose();
  };

  const accountTypes = ['Real', 'Funded', 'Demo'];

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-bold">Add Trading Account</h3>
          <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1">Account Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
              placeholder="e.g. My Trading Account"
              required 
            />
          </div>
          
          <div>
             <label className="block text-xs font-medium text-textMuted mb-1">Initial Balance ($)</label>
             <input 
               type="number" 
               value={formData.balance} 
               onChange={e => setFormData({...formData, balance: e.target.value as any})}
               className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
               placeholder="0.00"
             />
          </div>

          <div>
            <label className="block text-xs font-medium text-textMuted mb-2">Account Type</label>
            <div className="flex gap-2">
                {accountTypes.map(type => {
                    const isSelected = formData.type === type;
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({...formData, type: type as any})}
                            className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 ${
                                isSelected 
                                ? 'bg-primary text-white border-primary shadow-sm' 
                                : 'bg-surfaceHighlight text-textMuted border-transparent hover:text-textMain'
                            }`}
                        >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                            {type} Account
                        </button>
                    );
                })}
            </div>
          </div>

          <div className="pt-2">
             <button type="submit" className="w-full bg-primary hover:bg-blue-600 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm">
               <Save size={16} /> Create Account
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAccountModal;
