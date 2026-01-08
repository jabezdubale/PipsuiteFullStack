import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { Trade } from '../types';

interface AICoachProps {
  trades: Trade[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const AICoach: React.FC<AICoachProps> = ({ trades }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: "Hi! I'm your trading coach. Ask me about your performance, specific trades, or trading psychology." }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key not found");

      const ai = new GoogleGenAI({ apiKey });
      
      // Prepare context from recent trades
      const recentTrades = trades.slice(0, 5).map(t => 
        `Symbol: ${t.symbol}, Type: ${t.type}, PnL: ${t.pnl}, Setup: ${t.setup}, Status: ${t.status}`
      ).join('\n');

      const systemInstruction = `You are an expert trading coach. 
      Analyze the user's questions in the context of their recent trading data if provided.
      Be concise, encouraging, and focus on risk management and psychology.
      
      Recent Trades Context:
      ${recentTrades}
      `;
      
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const chatSession = ai.chats.create({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction },
        history: history
      });

      const result = await chatSession.sendMessage({ message: userMessage });
      const responseText = result.text;

      setMessages(prev => [...prev, { role: 'model', text: responseText || "I couldn't generate a response." }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error connecting to the AI coach." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="bg-surfaceHighlight p-4 border-b border-border flex items-center gap-2">
        <Bot className="text-primary" size={20} />
        <h3 className="font-bold text-textMain">AI Performance Coach</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-primary text-white' : 'bg-surfaceHighlight text-primary'
            }`}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div className={`p-3 rounded-lg max-w-[80%] text-sm ${
              msg.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none' 
                : 'bg-surfaceHighlight text-textMain rounded-tl-none border border-border'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-surface border-t border-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about your trades..."
            disabled={isLoading}
            className="flex-1 bg-surfaceHighlight border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-textMain"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICoach;