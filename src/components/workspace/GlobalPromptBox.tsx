'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, XCircle } from 'lucide-react';

interface AgentTemplate {
  id: string;
  name: string;
  role: string;
}

import ApprovalWidget from './ApprovalWidget';

export default function GlobalPromptBox({ conversationId }: { conversationId: string }) {
  const [prompt, setPrompt] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch available agents for @ mentions and available models
  useEffect(() => {
    fetch('/api/settings/mcp')
      .then(res => res.json())
      .then(data => {
        if (data.availableModels && data.availableModels.length > 0) {
          setAvailableModels(data.availableModels);
          setSelectedModel(data.availableModels[0].id);
        }
      })
      .catch(console.error);

    fetch('/api/workspace/agents')
      .then(res => res.json())
      .then(data => setTemplates(data))
      .catch(console.error);
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);

    // Naive @ mention detection for MVP
    const lastWord = val.split(' ').pop();
    if (lastWord && lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionFilter(lastWord.substring(1).toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (name: string) => {
    const words = prompt.split(' ');
    words.pop(); // remove the partial @mention
    const newText = [...words, `@${name} `].join(' ');
    setPrompt(newText);
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!prompt.trim()) return;
    
    const currentPrompt = prompt;
    setPrompt(''); // Optimistic clear
    
    try {
      await fetch(`/api/workspace/conversations/${conversationId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt, model: selectedModel })
      });
    } catch (err) {
      console.error('Failed to send global prompt:', err);
      setPrompt(currentPrompt); // Revert on failure
    }
  };

  const handleHalt = async () => {
    try {
      await fetch(`/api/workspace/conversations/${conversationId}/halt`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to halt swarm:', err);
    }
  };

  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(mentionFilter));

  // Determine who the prompt is targeting
  const mentionedAgent = templates.find(t => prompt.toLowerCase().includes(`@${t.name.toLowerCase()}`));
  const targetLabel = mentionedAgent ? `@${mentionedAgent.name}` : 'Boss Agent';

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent flex flex-col items-center pointer-events-none">
      
      {/* Inline Approvals Stacked Above Prompt Box */}
      <div className="pointer-events-auto w-full max-w-4xl flex justify-center">
        <ApprovalWidget conversationId={conversationId} />
      </div>
      
      <div className="w-full max-w-4xl relative mt-2 pointer-events-auto">
        
        {/* @ Mention Autocomplete Popup */}
        {showMentions && filteredTemplates.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Tag an Agent
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filteredTemplates.map(t => (
                <div 
                  key={t.id}
                  onClick={() => insertMention(t.name)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-700 cursor-pointer transition-colors"
                >
                  <Bot size={14} className="text-blue-400" />
                  <div>
                    <div className="text-white text-sm font-medium">{t.name}</div>
                    <div className="text-zinc-400 text-xs">{t.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="text-[11px] font-semibold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-800/50 shadow-sm">
            <Bot size={12} />
            Sending to: <span className="text-blue-300">{targetLabel}</span>
          </div>
        </div>

        <div className="relative group shadow-2xl rounded-xl">
          <textarea
            id="global-prompt-input"
            name="global-prompt-input"
            ref={inputRef}
            value={prompt}
            onChange={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a new task to orchestrate... Use @ to target a specific agent."
            className="w-full border border-zinc-700 rounded-xl pl-4 pr-[200px] py-4 text-white focus:outline-none focus:border-blue-500 transition-all resize-none h-[60px] max-h-[200px]"
            style={{ backgroundColor: 'var(--prompt-box, #18181b)' }}
            rows={1}
          />
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            
            {availableModels.length > 0 && (
              <select 
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-zinc-800 text-zinc-300 border border-zinc-700 rounded p-1.5 text-xs focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            )}

            <button 
              className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors group/halt"
              title="Halt Swarm"
              onClick={handleHalt}
            >
              <XCircle size={18} className="group-hover/halt:fill-red-950" />
            </button>
            <button 
              onClick={handleSend}
              disabled={!prompt.trim()}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-md"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
        
        <div className="text-center mt-2 text-[10px] text-zinc-500 font-mono">
          Shift+Enter for newline • @ to mention an agent
        </div>
      </div>
    </div>
  );
}
