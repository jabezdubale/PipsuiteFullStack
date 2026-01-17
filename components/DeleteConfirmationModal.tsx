
import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  count: number;
  tradeSymbol?: string; // If count is 1
  onConfirm: () => void;
  onCancel: () => void;
  mode: 'soft' | 'permanent';
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, count, tradeSymbol, onConfirm, onCancel, mode }) => {
  if (!isOpen) return null;

  const isSoft = mode === 'soft';
  
  const title = isSoft 
    ? (count === 1 ? "Move Trade to Trash?" : "Move Trades to Trash?")
    : (count === 1 ? "Delete Trade Forever?" : "Delete Trades Forever?");

  const mainMessage = count === 1 
    ? `Are you sure you want to ${isSoft ? 'move' : 'delete'} the ${tradeSymbol || 'selected'} trade${isSoft ? ' to trash' : ''}?` 
    : `Are you sure you want to ${isSoft ? 'move' : 'delete'} ${count} trades${isSoft ? ' to trash' : ''}?`;

  const subMessage = isSoft
    ? "Trades in the trash can be restored later. Any balance impact will be reversed."
    : "This action cannot be undone. All associated data and screenshots will be permanently removed.";

  const buttonText = isSoft ? "Move to Trash" : "Delete Forever";

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
            
            <h3 className="text-lg font-bold text-textMain mb-2">{title}</h3>
            
            <p className="text-sm text-textMuted mb-6">
                {mainMessage}
                <br/>
                <span className="text-xs opacity-70 mt-2 block">{subMessage}</span>
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
                    <Trash2 size={16} /> {buttonText}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
