
import React, { useState } from 'react';
import { TagGroup } from '../types';
import { Plus, X, Edit2, Check, XCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface TagManagerProps {
  groups: TagGroup[];
  onUpdate: (groups: TagGroup[]) => void;
  onCleanupTag?: (tag: string) => void;
}

const TagManager: React.FC<TagManagerProps> = ({ groups, onUpdate, onCleanupTag }) => {
  const [newTagInputs, setNewTagInputs] = useState<Record<number, string>>({});
  const [editingTag, setEditingTag] = useState<{ groupIdx: number, tagIdx: number, value: string } | null>(null);
  const [expandedGroupIdx, setExpandedGroupIdx] = useState<number | null>(null);

  const handleAddTag = (groupIdx: number) => {
    const val = newTagInputs[groupIdx]?.trim();
    if (!val) return;
    
    // Add # if missing
    const formatted = val.startsWith('#') ? val : `#${val}`;
    
    const newGroups = [...groups];
    if (!newGroups[groupIdx].tags.includes(formatted)) {
        newGroups[groupIdx] = {
            ...newGroups[groupIdx],
            tags: [...newGroups[groupIdx].tags, formatted]
        };
        onUpdate(newGroups);
    }
    setNewTagInputs(prev => ({ ...prev, [groupIdx]: '' }));
  };

  const handleDeleteTag = (groupIdx: number, tagIdx: number) => {
      const tagToDelete = groups[groupIdx].tags[tagIdx];
      
      if (window.confirm(`Delete tag "${tagToDelete}"?`)) {
        if (onCleanupTag) {
            if (window.confirm(`Also remove "${tagToDelete}" from all existing trades? (Ghost tags will remain if Cancel)`)) {
                onCleanupTag(tagToDelete);
            }
        }
        
        const newGroups = [...groups];
        newGroups[groupIdx] = {
            ...newGroups[groupIdx],
            tags: newGroups[groupIdx].tags.filter((_, i) => i !== tagIdx)
        };
        onUpdate(newGroups);
        setEditingTag(null);
      }
  };

  const startEdit = (groupIdx: number, tagIdx: number, currentVal: string) => {
      setEditingTag({ groupIdx, tagIdx, value: currentVal });
  };

  const saveEdit = () => {
      if (!editingTag) return;
      const { groupIdx, tagIdx, value } = editingTag;
      if (!value.trim()) {
          setEditingTag(null);
          return;
      }
      
      const formatted = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
      
      const newGroups = [...groups];
      const tags = [...newGroups[groupIdx].tags];
      tags[tagIdx] = formatted;
      newGroups[groupIdx] = { ...newGroups[groupIdx], tags };
      
      onUpdate(newGroups);
      setEditingTag(null);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4 shadow-sm mt-4">
        <h3 className="font-semibold mb-3 text-sm text-primary">Manage Tags</h3>
        <div className="space-y-2">
            {groups.map((group, groupIdx) => {
                const isExpanded = expandedGroupIdx === groupIdx;

                return (
                    <div key={group.name} className={`border border-border rounded-md bg-background/50 transition-all ${isExpanded ? 'p-3 border-primary/30' : 'p-2 hover:border-primary/50'}`}>
                        <button 
                            onClick={() => setExpandedGroupIdx(isExpanded ? null : groupIdx)}
                            className="w-full flex justify-between items-center text-left"
                        >
                            <div className="flex items-center gap-2">
                                <h4 className="font-medium text-xs text-textMain uppercase tracking-wider">{group.name}</h4>
                                <span className="text-[9px] bg-surfaceHighlight px-1.5 py-0.5 rounded text-textMuted border border-border">{group.tags.length} tags</span>
                            </div>
                            <div className="text-textMuted">
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                        </button>
                        
                        {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border animate-in fade-in slide-in-from-top-1">
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {group.tags.map((tag, tagIdx) => {
                                        const isEditing = editingTag?.groupIdx === groupIdx && editingTag?.tagIdx === tagIdx;
                                        
                                        if (isEditing) {
                                            return (
                                                <div key={tagIdx} className="flex items-center gap-1 bg-surfaceHighlight rounded px-1 py-0.5 border border-primary animate-in fade-in zoom-in-95">
                                                    <input 
                                                        autoFocus
                                                        value={editingTag.value}
                                                        onChange={(e) => setEditingTag({...editingTag, value: e.target.value})}
                                                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                                        className="w-20 bg-transparent text-[10px] outline-none text-textMain"
                                                    />
                                                    <div className="flex items-center gap-0.5 border-l border-primary/20 pl-1 ml-1">
                                                        <button onClick={saveEdit} className="text-profit hover:bg-profit/10 rounded p-0.5" title="Save"><Check size={10}/></button>
                                                        <button onClick={() => handleDeleteTag(groupIdx, tagIdx)} className="text-loss hover:bg-loss/10 rounded p-0.5" title="Delete"><Trash2 size={10}/></button>
                                                        <button onClick={() => setEditingTag(null)} className="text-textMuted hover:text-textMain hover:bg-surface rounded p-0.5" title="Cancel"><XCircle size={10}/></button>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        return (
                                            <div key={tagIdx} className="group flex items-center gap-1 px-1.5 py-0.5 bg-surface border border-border rounded-md text-[10px] text-textMuted hover:border-primary/50 transition-all">
                                                <span>{tag}</span>
                                                <div className="flex gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEdit(groupIdx, tagIdx, tag)} className="text-primary hover:text-blue-600 p-0.5"><Edit2 size={8}/></button>
                                                    <button onClick={() => handleDeleteTag(groupIdx, tagIdx)} className="text-loss hover:text-red-600 p-0.5"><Trash2 size={8}/></button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="flex gap-2 max-w-xs">
                                    <input 
                                        type="text"
                                        placeholder="Add tag..."
                                        value={newTagInputs[groupIdx] || ''}
                                        onChange={(e) => setNewTagInputs({...newTagInputs, [groupIdx]: e.target.value})}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag(groupIdx)}
                                        className="flex-1 bg-surfaceHighlight border border-border rounded px-2 py-1 text-xs text-textMain focus:outline-none focus:border-primary h-7"
                                    />
                                    <button 
                                        onClick={() => handleAddTag(groupIdx)}
                                        className="px-2 py-1 bg-primary hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 h-7"
                                    >
                                        <Plus size={12} /> Add
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default TagManager;
