
import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  count: number;
  tradeSymbol?: string; // If count is 1
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, count, tradeSymbol, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onCancel}
    >
      <div 
        className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
            <div className="w-12 h-12 bg-loss/10 text-loss rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} />
            </div>
            
            <h3 className="text-lg font-bold text-textMain mb-2">Delete Trade{count > 1 ? 's' : ''}?</h3>
            
            <p className="text-sm text-textMuted mb-6">
                {count === 1 
                  ? `Are you sure you want to delete the ${tradeSymbol || 'selected'} trade?` 
                  : `Are you sure you want to delete ${count} trades?`
                }
                <br/>
                <span className="text-xs opacity-70 mt-2 block">This action cannot be undone and will reverse any balance changes.</span>
            </p>

            <div className="flex gap-3 justify-center">
                <button 
                    onClick={onCancel}
                    className="px-4 py-2 text-sm font-medium text-textMain bg-surface border border-border rounded-lg hover:bg-surfaceHighlight transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={onConfirm}
                    className="px-4 py-2 text-sm font-bold text-white bg-loss hover:bg-red-600 rounded-lg shadow-lg shadow-red-500/20 transition-colors flex items-center gap-2"
                >
                    <Trash2 size={16} /> Delete
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
