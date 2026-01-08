
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { X, Save, User as UserIcon, Key, Eye, EyeOff } from 'lucide-react';

interface UserModalProps {
  user?: User | null; // If null, we are creating a new user
  onSave: (user: Partial<User>) => void;
  onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    twelveDataApiKey: ''
  });

  const [showTwelveDataKey, setShowTwelveDataKey] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        twelveDataApiKey: user.twelveDataApiKey || ''
      });
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    onSave(formData);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <UserIcon size={20} className="text-primary" />
            {user ? 'Edit Profile' : 'Create User'}
          </h3>
          <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1">User Name</label>
            <input 
              type="text" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full bg-background border border-border rounded p-2.5 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
              placeholder="Enter your name"
              required 
            />
          </div>
          
          <div className="space-y-4 pt-2 border-t border-border">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-textMain">
                <Key size={16} /> API Keys
            </h4>
            <p className="text-xs text-textMuted">Provide your own keys to enable advanced features.</p>
            
            <div>
               <label className="block text-xs font-medium text-textMuted mb-1">Twelve Data API Key (Prices)</label>
               <div className="relative">
                 <input 
                   type={showTwelveDataKey ? "text" : "password"}
                   value={formData.twelveDataApiKey} 
                   onChange={e => setFormData({...formData, twelveDataApiKey: e.target.value.trim()})}
                   className="w-full bg-background border border-border rounded p-2.5 pr-10 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none"
                   placeholder="Enter Twelve Data API Key"
                   autoComplete="off"
                 />
                 <button
                    type="button"
                    onClick={() => setShowTwelveDataKey(!showTwelveDataKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain"
                 >
                    {showTwelveDataKey ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>
               </div>
            </div>
          </div>

          <div className="pt-2">
             <button type="submit" className="w-full bg-primary hover:bg-blue-600 text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 text-sm shadow-lg">
               <Save size={16} /> {user ? 'Save Changes' : 'Create User'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
