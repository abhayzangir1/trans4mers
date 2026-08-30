'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Hash, User, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { useOSStore } from '@/store/useOSStore';

interface Channel {
  id: string;
  name: string;
  isDM: boolean;
  isReadOnly?: boolean;
}

interface Message {
  id: string;
  role: string;
  content: string;
  senderId: string;
  createdAt: string;
  requiresApproval?: boolean;
  approvalState?: string;
}

interface AgentInstance {
  id: string;
  templateId: string;
  parentInstanceId: string | null;
  status: string;
  template: { name: string; role: string };
}

export default function SlackMode({ conversationId }: { conversationId: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string>('human');
  const [swarmMembers, setSwarmMembers] = useState<AgentInstance[]>([]);
  const [metadata, setMetadata] = useState<{ projectName: string, title: string | null } | null>(null);

  const fetchChannels = () => {
    fetch(`/api/workspace/conversations/${conversationId}/channels?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setChannels(data);
          setActiveChannel((prevActive) => {
            if (!prevActive || !data.some(c => c.id === prevActive.id)) {
              return data.find(c => c.name === 'shared-blackboard') || data[0] || null;
            }
            return prevActive;
          });
        }
      })
      .catch(console.error);
  };

  const fetchMetadata = () => {
    fetch(`/api/workspace/conversations/${conversationId}`)
      .then(res => res.json())
      .then(data => setMetadata(data))
      .catch(console.error);
  };

  const fetchSwarmMembers = () => {
    fetch(`/api/workspace/conversations/${conversationId}/agents?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSwarmMembers(data);
        }
      })
      .catch(() => toast.error('Failed to fetch swarm members'));
  };

  useEffect(() => {
    setActiveChannel(null);
    setChannels([]);
    setMessages([]);
    setSwarmMembers([]);
    fetchMetadata();
    fetch(`/api/settings/mcp?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => setUserId(data.userId || 'human'))
      .catch(() => {});
      
    fetchChannels();
    fetchSwarmMembers();
  }, [conversationId]);

  useEffect(() => {
    if (!activeChannel) return;
    
    const loadMessages = () => {
      fetch(`/api/workspace/channels/${activeChannel.id}/messages?_t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data);
            scrollToBottom();
          }
        })
        .catch(() => toast.error('Failed to fetch messages'));
    };

    loadMessages();

    const eventSource = new EventSource('/api/sse');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.channel === 'chat_updates' && data.payload?.id === conversationId) {
          loadMessages();
        }
        if (data.channel === 'agent_updates' && data.payload?.id === conversationId) {
          fetchSwarmMembers();
        }
      } catch (e) {
        console.error('SSE Parse error in SlackMode:', e);
      }
    };

    return () => eventSource.close();
  }, [activeChannel, conversationId]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const createOrOpenDM = async (agent: AgentInstance) => {
    try {
      const res = await fetch(`/api/workspace/conversations/${conversationId}/channels/dm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, agentName: agent.template.name })
      });
      const channel = await res.json();
      
      // Refresh channels and set active
      fetch(`/api/workspace/conversations/${conversationId}/channels`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setChannels(data);
            setActiveChannel(channel);
          }
        });
    } catch (err) {
      toast.error('Failed to create/open DM');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChannel || activeChannel.isReadOnly) return;

    const msg = inputText;
    setInputText('');

    try {
      if (activeChannel.isDM) {
        // Find the target agent by name matching the DM channel
        const targetAgent = swarmMembers.find(a => a.template.name === activeChannel.name);
        
        // Trigger the agent orchestrator, ignoring the stream for now (we poll to get messages anyway)
        fetch(`/api/workspace/conversations/${conversationId}/prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: msg, targetAgentId: targetAgent?.id })
        });
        
        // Optimistically add message
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          channelId: activeChannel.id,
          senderId: userId,
          role: 'user',
          content: msg,
          createdAt: new Date().toISOString(),
          requiresApproval: false
        } as any]);
        scrollToBottom();
      } else {
        // Standard channel message - post directly without starting a new loop.
        // Agents currently in a ReAct loop will see this via live steering.
        fetch(`/api/workspace/channels/${activeChannel.id}/post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: msg })
        });
        
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          channelId: activeChannel.id,
          senderId: userId,
          role: 'user',
          content: msg,
          createdAt: new Date().toISOString(),
          requiresApproval: false
        } as any]);
        scrollToBottom();
      }
    } catch (err) {
      toast.error('Failed to send message');
    }
  };

  const handleApproval = async (messageId: string, action: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await fetch(`/api/workspace/messages/${messageId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      if (res.ok) {
        setMessages(prev => prev.map(msg => msg.id === messageId ? { ...msg, approvalState: action } : msg));
      } else {
        toast.error('Failed to approve/reject message');
      }
    } catch (err) {
      toast.error('Failed to approve/reject message');
    }
  };

  return (
    <div className="flex h-full w-full bg-zinc-950">
      
      {/* Inner Slack Sidebar */}
      <div className="w-64 border-r border-zinc-800 bg-[#19171D] flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="font-bold text-white truncate text-sm">Agent Workspace</h2>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          
          <div className="mb-4">
            <div className="px-4 text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider">Channels</div>
            {channels.filter(c => !c.isDM).map(c => (
              <div 
                key={c.id} 
                onClick={() => setActiveChannel(c)}
                className={`px-4 py-1 flex items-center gap-2 cursor-pointer transition-colors ${activeChannel?.id === c.id ? 'bg-[#1164A3] text-white' : 'text-zinc-400 hover:bg-[#27242C]'}`}
              >
                <Hash size={14} /> {c.name}
              </div>
            ))}
          </div>

          <div className="mb-4">
            <div className="px-4 text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider">Direct Messages</div>
            {channels.filter(c => c.isDM).map(c => (
              <div 
                key={c.id} 
                onClick={() => setActiveChannel(c)}
                className={`px-4 py-1 flex items-center gap-2 cursor-pointer transition-colors ${activeChannel?.id === c.id ? 'bg-[#1164A3] text-white' : 'text-zinc-400 hover:bg-[#27242C]'}`}
              >
                <User size={14} /> {c.name}
              </div>
            ))}
          </div>

          <div>
            <div className="px-4 text-xs font-semibold text-zinc-400 mb-1 uppercase tracking-wider">Swarm Members</div>
            {swarmMembers.map(agent => (
              <div 
                key={agent.id} 
                onClick={() => createOrOpenDM(agent)}
                className="px-4 py-1 flex items-center gap-2 cursor-pointer transition-colors text-zinc-400 hover:bg-[#27242C]"
                title={agent.template.role}
              >
                <div className={`w-2 h-2 rounded-full ${agent.status === 'RUNNING' ? 'bg-green-500' : 'bg-zinc-600'}`}></div>
                {agent.template.name} ({agent.id.substring(0,4)})
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {activeChannel?.isDM ? <User size={20} className="text-zinc-400" /> : <Hash size={20} className="text-zinc-400" />}
            <h2 className="font-bold text-white capitalize">{activeChannel?.name || 'Select a channel'}</h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map(msg => {
            const getSenderName = () => {
              if (msg.senderId === 'human' || msg.senderId === 'user' || msg.senderId === userId) return 'You';
              if (msg.senderId === 'system' || msg.senderId === 'overseer') return 'System Overseer';
              if (msg.role === 'agent') {
                const agent = swarmMembers.find(a => a.id === msg.senderId);
                return agent ? `${agent.template.name}` : `Agent (${msg.senderId.substring(0,4)})`;
              }
              return msg.senderId;
            };
            const senderName = getSenderName();
            const getAvatar = () => {
              if (msg.senderId === 'human' || msg.senderId === 'user' || msg.senderId === userId) return '👤';
              if (msg.senderId === 'system' || msg.senderId === 'overseer') return '⚙️';
              return '🤖';
            };

            return (
            <div key={msg.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 text-lg">
                {getAvatar()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="font-bold text-white capitalize">{senderName}</span>
                  <span className="text-xs text-zinc-500">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                </div>
                
                <div className="text-zinc-300 whitespace-pre-wrap font-sans text-sm bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/50">
                  {(() => {
                    try {
                      if (msg.content.startsWith('[')) {
                        const parsed = JSON.parse(msg.content);
                        if (Array.isArray(parsed)) {
                          return parsed.map((p, i) => {
                            if (p.text) return <span key={i}>{p.text}</span>;
                            if (p.toolRequest) return <div key={i} className="text-blue-400 italic font-mono text-xs mt-1">Tool Request: {p.toolRequest.name}</div>;
                            return null;
                          });
                        }
                      }
                      return msg.content;
                    } catch (e) {
                      return msg.content;
                    }
                  })()}
                </div>

                {msg.requiresApproval && msg.approvalState === 'PENDING' && (
                  <div className="mt-3 p-3 bg-zinc-900 border border-emerald-500/30 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-emerald-400 font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                      Agent is awaiting your approval to proceed
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproval(msg.id, 'REJECTED')} className="px-4 py-1.5 text-xs font-bold bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 rounded transition-colors">
                        Reject
                      </button>
                      <button onClick={() => handleApproval(msg.id, 'APPROVED')} className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded shadow-lg transition-colors">
                        Approve & Proceed
                      </button>
                    </div>
                  </div>
                )}
                {msg.requiresApproval && msg.approvalState === 'APPROVED' && (
                  <div className="mt-2 text-xs text-emerald-500 flex items-center gap-1">? Approved</div>
                )}
                {msg.requiresApproval && msg.approvalState === 'REJECTED' && (
                  <div className="mt-2 text-xs text-red-500 flex items-center gap-1">? Rejected</div>
                )}

              </div>
            </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 pt-2">
          <form onSubmit={sendMessage} className="relative">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder={activeChannel?.isReadOnly ? "This channel is read-only" : (activeChannel?.isDM ? `Message @${activeChannel?.name}...` : `Post to #${activeChannel?.name} (agents will see this)...`)}
              disabled={!activeChannel || activeChannel.isReadOnly}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-4 pr-12 py-3 text-white focus:outline-none focus:border-zinc-500 disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={!activeChannel || activeChannel.isReadOnly || !inputText.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded disabled:opacity-50 transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}



