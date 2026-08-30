'use client';

import React, { useState } from 'react';
import { X, LayoutTemplate } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewProjectModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/workspace/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });
      if (res.ok) {
        toast.success('Project created!');
        onSuccess();
        onClose();
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Failed to create project');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl w-[450px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <LayoutTemplate size={18} className="text-emerald-400" /> Create New Project
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Project Name</label>
            <input 
              autoFocus
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Genesis E-Commerce"
              className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Briefly describe what this project is for..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none h-24"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
            <button type="submit" disabled={loading || !name.trim()} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded shadow-lg disabled:opacity-50 transition-colors">
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
