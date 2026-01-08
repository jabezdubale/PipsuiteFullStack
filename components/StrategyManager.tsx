
import React, { useState } from 'react';
import { Plus, X, Edit2, Check, XCircle, Trash2 } from 'lucide-react';

interface StrategyManagerProps {
  strategies: string[];
  onUpdate: (strategies: string[]) => void;
}

const StrategyManager: React.FC<StrategyManagerProps> = ({ strategies, onUpdate }) => {
  const [newStrategy, setNewStrategy] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = () => {
    if (!newStrategy.trim()) return;
    if (strategies.includes(newStrategy.trim())) return;
    onUpdate([...strategies, newStrategy.trim()]);
    setNewStrategy('');
  };

  const handleDelete = (index: number) => {
    if (window.confirm('Delete this strategy?')) {
        const newStrategies = strategies.filter((_, i) => i !== index);
        onUpdate(newStrategies);
        setEditingIndex(null); // Close edit mode if open
    }
  };

  const startEdit = (index: number, val: string) => {
    setEditingIndex(index);
    setEditValue(val);
  };

  const saveEdit = () => {
    if (editingIndex === null || !editValue.trim()) return;
    
    const updated = [...strategies];
    updated[editingIndex] = editValue.trim();
    onUpdate(updated);
    setEditingIndex(null);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm mt-4">
      <h3 className="font-semibold mb-3 text-sm text-primary">Manage Strategies</h3>
      
      <div className="flex flex-wrap gap-2 mb-3">
        {strategies.map((strategy, index) => {
          const isEditing = editingIndex === index;

          if (isEditing) {
             return (
                 <div key={index} className="flex items-center gap-1 bg-surfaceHighlight rounded px-1.5 py-0.5 border border-primary animate-in fade-in zoom-in-95">
                     <input 
                         autoFocus
                         value={editValue}
                         onChange={(e) => setEditValue(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                         className="w-24 bg-transparent text-xs outline-none text-textMain"
                     />
                     <div className="flex items-center gap-0.5 border-l border-primary/20 pl-1 ml-1">
                        <button onClick={saveEdit} className="text-profit hover:bg-profit/10 rounded p-1" title="Save"><Check size={12}/></button>
                        <button onClick={() => handleDelete(index)} className="text-loss hover:bg-loss/10 rounded p-1" title="Delete"><Trash2 size={12}/></button>
                        <button onClick={() => setEditingIndex(null)} className="text-textMuted hover:text-textMain hover:bg-surface rounded p-1" title="Cancel"><XCircle size={12}/></button>
                     </div>
                 </div>
             )
          }

          return (
            <div key={index} className="group flex items-center gap-1.5 px-2 py-1 bg-surface border border-border rounded-md text-xs text-textMain hover:border-primary/50 transition-all">
              <span>{strategy}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pl-1 border-l border-border/50 ml-1">
                <button onClick={() => startEdit(index, strategy)} className="text-primary hover:text-blue-600"><Edit2 size={10}/></button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 max-w-xs">
        <input 
            type="text"
            placeholder="Add new..."
            value={newStrategy}
            onChange={(e) => setNewStrategy(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 bg-surfaceHighlight border border-border rounded px-2 py-1 text-xs text-textMain focus:outline-none focus:border-primary h-7"
        />
        <button 
            onClick={handleAdd}
            className="px-2 py-1 bg-primary hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 h-7"
        >
            <Plus size={12} /> Add
        </button>
      </div>
    </div>
  );
};

export default StrategyManager;
