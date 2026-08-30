'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface ApprovalRequest {
  id: string;
  senderId: string;
  content: string;
}

export default function ApprovalWidget({ conversationId }: { conversationId: string }) {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchApprovals = () => {
    fetch(`/api/workspace/conversations/${conversationId}/approvals`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRequests(data);
          if (data.length === 0) setIsExpanded(true);
        }
      })
      .catch(console.error);
  };

  // Listen to global SSE for instant real-time updates
  useEffect(() => {
    fetchApprovals();
    
    const eventSource = new EventSource('/api/sse');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // If chat updates for this conversation arrive, refetch approvals
        if (payload.channel === 'chat_updates' && payload.payload === conversationId) {
          fetchApprovals();
        }
      } catch (err) { console.error('ApprovalWidget SSE parse error:', err); }
    };

    return () => eventSource.close();
  }, [conversationId]);

  const handleAction = async (messageId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      await fetch(`/api/workspace/messages/${messageId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, customFeedback: feedback[messageId] || '' })
      });
      // Optimistic update
      setRequests(prev => prev.filter(r => r.id !== messageId));
    } catch (err) {
      console.error(err);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="z-50 flex flex-col gap-2 w-[500px]">
      
      {requests.length > 1 && (
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer mx-auto flex items-center gap-2 shadow-lg hover:bg-zinc-700 transition-colors"
        >
          <AlertCircle size={14} className="text-blue-400" />
          {requests.length} Pending Approvals
          {isExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </div>
      )}

      {isExpanded && requests.map(req => (
        <div key={req.id} className="bg-zinc-900 border border-blue-500/50 rounded-lg shadow-2xl p-4 text-white">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm mb-2 uppercase tracking-wide">
            <AlertCircle size={16} />
            Human Approval Required
          </div>
          
          <div className="text-sm text-zinc-300 mb-3 bg-black/50 p-2 rounded">
            <span className="font-semibold text-zinc-400">Agent ({req.senderId.substring(0,6)}):</span> {req.content}
          </div>

          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              placeholder="Custom feedback or instructions (optional)..."
              value={feedback[req.id] || ''}
              onChange={(e) => setFeedback(prev => ({ ...prev, [req.id]: e.target.value }))}
              className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
            
            <div className="flex justify-end gap-2 mt-1">
              <button 
                onClick={() => handleAction(req.id, 'REJECTED')}
                className="flex items-center gap-1 bg-red-950/50 hover:bg-red-900 text-red-400 hover:text-red-300 px-3 py-1.5 rounded text-xs font-medium transition-colors border border-red-900/50"
              >
                <X size={14} /> Reject
              </button>
              <button 
                onClick={() => handleAction(req.id, 'APPROVED')}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-medium transition-colors"
              >
                <Check size={14} /> Approve & Execute
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
