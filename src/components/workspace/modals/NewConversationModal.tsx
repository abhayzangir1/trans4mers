'use client';

import React, { useState } from 'react';
import { X, MessageSquarePlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export default function NewConversationModal({ isOpen, onClose, projectId }: Props) {
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;
    setLoading(true);

    try {
      const res = await fetch('/api/workspace/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, title })
      });
      if (res.ok) {
        const convo = await res.json();
        onClose();
        router.push(`/workspace/${projectId}/${convo.id}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-[400px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MessageSquarePlus size={18} className="text-blue-400" /> New Conversation
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Conversation Topic</label>
            <input 
              autoFocus
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Debugging the Auth Flow"
              className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !title.trim()} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded shadow-lg disabled:opacity-50 transition-colors">
              {loading ? 'Starting...' : 'Start Swarm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
