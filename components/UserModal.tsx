
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { X, Save, User as UserIcon, Key, Eye, EyeOff, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { fetchCurrentPrice } from '../services/priceService';
import { GoogleGenAI } from "@google/genai";

interface UserModalProps {
  user?: User | null; // If null, we are creating a new user
  onSave: (user: Partial<User>) => void;
  onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    twelveDataApiKey: '',
    geminiApiKey: ''
  });

  const [showTwelveDataKey, setShowTwelveDataKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
      gemini: 'idle' | 'success' | 'error',
      twelveData: 'idle' | 'success' | 'error'
  }>({ gemini: 'idle', twelveData: 'idle' });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        twelveDataApiKey: user.twelveDataApiKey || '',
        geminiApiKey: user.geminiApiKey || ''
      });
    }
  }, [user]);

  const testConnections = async () => {
      setIsTesting(true);
      setConnectionStatus({ gemini: 'idle', twelveData: 'idle' });
      
      let geminiStatus: 'success' | 'error' = 'success';
      let twelveDataStatus: 'success' | 'error' = 'success';

      // Test Gemini
      if (formData.geminiApiKey) {
          try {
              const ai = new GoogleGenAI({ apiKey: formData.geminiApiKey });
              await ai.models.generateContent({
                  model: 'gemini-3-flash-preview',
                  contents: { parts: [{ text: 'Hello' }] },
              });
              geminiStatus = 'success';
          } catch (e) {
              console.error("Gemini Test Failed", e);
              geminiStatus = 'error';
          }
      } else {
          geminiStatus = 'error';
      }

      // Test Twelve Data
      if (formData.twelveDataApiKey) {
          try {
              const res = await fetchCurrentPrice('EURUSD', formData.twelveDataApiKey);
              if (!res) throw new Error("No Data");
              twelveDataStatus = 'success';
          } catch (e) {
              console.error("Twelve Data Test Failed", e);
              twelveDataStatus = 'error';
          }
      } else {
          twelveDataStatus = 'error';
      }

      setConnectionStatus({ gemini: geminiStatus, twelveData: twelveDataStatus });
      setIsTesting(false);
      return geminiStatus === 'success' && twelveDataStatus === 'success';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    // If editing existing user and keys didn't change, allow save without re-test
    const isEditing = !!user;
    const keysChanged = user ? (user.geminiApiKey !== formData.geminiApiKey || user.twelveDataApiKey !== formData.twelveDataApiKey) : true;

    if (keysChanged) {
        const success = await testConnections();
        if (!success) {
            alert("One or more API connections failed. Please check your keys.");
            return;
        }
    }

    onSave(formData);
    onClose();
  };

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
          <h3 className="text-lg font-bold flex items-center gap-2">
            <UserIcon size={20} className="text-primary" />
            {user ? 'Edit Profile' : 'Create User'}
          </h3>
          <button onClick={onClose} className="text-textMuted hover:text-textMain"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1">Full Name</label>
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
            <p className="text-xs text-textMuted">Valid API keys are required to create or update a user.</p>
            
            {/* Gemini Key Input */}
            <div>
               <div className="flex justify-between mb-1">
                   <label className="block text-xs font-medium text-textMuted">Gemini API Key</label>
                   {connectionStatus.gemini === 'success' && <span className="text-[10px] text-profit flex items-center gap-1"><Check size={10}/> Verified</span>}
                   {connectionStatus.gemini === 'error' && <span className="text-[10px] text-loss flex items-center gap-1"><AlertTriangle size={10}/> Invalid</span>}
               </div>
               <div className="relative">
                 <input 
                   type={showGeminiKey ? "text" : "password"}
                   value={formData.geminiApiKey} 
                   onChange={e => setFormData({...formData, geminiApiKey: e.target.value.trim()})}
                   className={`w-full bg-background border rounded p-2.5 pr-10 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none ${connectionStatus.gemini === 'error' ? 'border-loss' : 'border-border'}`}
                   placeholder="AIzaSy..."
                   autoComplete="off"
                   required
                 />
                 <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain"
                 >
                    {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>
               </div>
            </div>

            {/* Twelve Data Key Input */}
            <div>
               <div className="flex justify-between mb-1">
                   <label className="block text-xs font-medium text-textMuted">Twelve Data API Key</label>
                   {connectionStatus.twelveData === 'success' && <span className="text-[10px] text-profit flex items-center gap-1"><Check size={10}/> Verified</span>}
                   {connectionStatus.twelveData === 'error' && <span className="text-[10px] text-loss flex items-center gap-1"><AlertTriangle size={10}/> Invalid</span>}
               </div>
               <div className="relative">
                 <input 
                   type={showTwelveDataKey ? "text" : "password"}
                   value={formData.twelveDataApiKey} 
                   onChange={e => setFormData({...formData, twelveDataApiKey: e.target.value.trim()})}
                   className={`w-full bg-background border rounded p-2.5 pr-10 text-sm text-textMain focus:ring-1 focus:ring-primary outline-none ${connectionStatus.twelveData === 'error' ? 'border-loss' : 'border-border'}`}
                   placeholder="Enter Key"
                   autoComplete="off"
                   required
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

          <div className="flex gap-3 pt-2">
             <button 
                type="button" 
                onClick={testConnections}
                disabled={isTesting || !formData.geminiApiKey || !formData.twelveDataApiKey}
                className="flex-1 bg-surfaceHighlight hover:bg-border text-textMain py-2.5 rounded-lg font-medium text-sm transition-colors border border-border flex items-center justify-center gap-2"
             >
                 {isTesting ? <Loader2 size={16} className="animate-spin"/> : 'Test Connection'}
             </button>
             <button 
                type="submit" 
                disabled={isTesting}
                className="flex-1 bg-primary hover:bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm shadow-lg flex items-center justify-center gap-2"
             >
               <Save size={16} /> {user ? 'Save Changes' : 'Create User'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
