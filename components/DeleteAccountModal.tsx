
import React, { useState, useEffect } from 'react';
import { Account } from '../types';
import { X, AlertTriangle, Trash2, ChevronDown } from 'lucide-react';

interface DeleteAccountModalProps {
  accountToDelete: Account;
  otherAccounts: Account[];
  onClose: () => void;
  onConfirm: (fallbackAccountId: string) => void;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({ accountToDelete, otherAccounts, onClose, onConfirm }) => {
  const [inputValue, setInputValue] = useState('');
  const [fallbackId, setFallbackId] = useState<string>('');

  useEffect(() => {
      if (otherAccounts.length > 0) {
          setFallbackId(otherAccounts[0].id);
      }
  }, [otherAccounts]);

  const isMatch = inputValue === accountToDelete.name;
  const isLastAccount = otherAccounts.length === 0;
  
  // Only allow delete if it's not the last account, name matches, and a fallback is selected
  const canDelete = !isLastAccount && isMatch && fallbackId !== '';

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
        <div 
          className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl" 
          onClick={e => e.stopPropagation()}
        >
            <div className="p-5 border-b border-border flex justify-between items-center">
                <h3 className="text-lg font-bold text-loss flex items-center gap-2">
                    <AlertTriangle size={20} /> Delete Account
                </h3>
                <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={20}/></button>
            </div>
            
            <div className="p-5 space-y-4">
                <p className="text-sm text-textMain">
                    Are you sure you want to delete <span className="font-bold">{accountToDelete.name}</span>?
                </p>
                
                {isLastAccount ? (
                    <div className="bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg">
                        <p className="text-xs text-orange-500 font-medium flex items-start gap-2">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>You cannot delete the only remaining account. Please create another account first to maintain app functionality.</span>
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="bg-loss/10 border border-loss/20 p-3 rounded-lg">
                            <p className="text-xs text-loss font-medium flex items-start gap-2">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <span>Warning: This action is permanent. All trades and data associated with this account will be erased immediately.</span>
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">
                                Select Fallback Account
                            </label>
                            <p className="text-[10px] text-textMuted mb-2">
                                This account will be selected after deletion.
                            </p>
                            <div className="relative">
                                <select 
                                    value={fallbackId} 
                                    onChange={(e) => setFallbackId(e.target.value)}
                                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none appearance-none"
                                >
                                    {otherAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted pointer-events-none" />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-medium text-textMuted mb-1">
                                Type <span className="font-bold text-textMain select-all">{accountToDelete.name}</span> to confirm
                            </label>
                            <input 
                                type="text" 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                className="w-full bg-background border border-border rounded p-2 text-sm text-textMain focus:ring-1 focus:ring-loss outline-none"
                                placeholder={accountToDelete.name}
                                autoFocus
                            />
                        </div>
                    </>
                )}
            </div>

            <div className="p-4 border-t border-border flex justify-end gap-3 bg-surfaceHighlight/30 rounded-b-xl">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-textMuted hover:text-textMain">Cancel</button>
                <button 
                    onClick={() => onConfirm(fallbackId)} 
                    disabled={!canDelete}
                    className={`px-4 py-2 text-sm font-bold text-white rounded-lg flex items-center gap-2 transition-all ${
                        canDelete 
                        ? 'bg-loss hover:bg-red-600 shadow-lg shadow-red-500/20' 
                        : 'bg-surfaceHighlight text-textMuted cursor-not-allowed opacity-50'
                    }`}
                >
                    <Trash2 size={16} /> Delete Account
                </button>
            </div>
        </div>
    </div>
  );
};

export default DeleteAccountModal;
