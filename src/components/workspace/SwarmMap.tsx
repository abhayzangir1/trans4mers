'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ReactFlow, MiniMap, Controls, Background, Node, Edge, useNodesState, useEdgesState , addEdge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
// @ts-expect-error
import dagre from 'dagre';

interface AgentInstance {
  id: string;
  templateId: string;
  parentInstanceId: string | null;
  status: string;
  template: { name: string; role: string };
}

const nodeWidth = 200;
const nodeHeight = 100;

export default function SwarmMap({ conversationId }: { conversationId: string }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [liveLogs, setLiveLogs] = useState<{id: string, content: string}[]>([]);
  const [inlineCommand, setInlineCommand] = useState('');

  const onConnect = useCallback(
    (params: Connection) => {
      if (params.target === 'user') {
        alert('Cannot delegate tasks to the Human User.');
        return;
      }
      
      const task = window.prompt('What task do you want to delegate via this connection?');
      if (!task) return;

      fetch(`/api/workspace/conversations/${conversationId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: `[DELEGATION] Execute this task immediately: ${task}`,
          targetAgentId: params.target 
        })
      });

      setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#eab308', strokeWidth: 2 } }, eds));
    },
    [conversationId, setEdges],
  );

  const sendInlineCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineCommand.trim() || !selectedAgentId || selectedAgentId === 'user') return;
    
    const cmd = inlineCommand;
    setInlineCommand('');

    try {
      await fetch(`/api/workspace/conversations/${conversationId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cmd, targetAgentId: selectedAgentId })
      });
    } catch (err) {
      console.error('Failed to send inline command:', err);
    }
  };

  const getLayoutedElements = (initialNodes: Node[], initialEdges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 150, ranksep: 150 });

    initialNodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    initialEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    initialNodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
    });

    return { nodes: initialNodes, edges: initialEdges };
  };

  const handleMicroHalt = async (agentId: string, force: boolean = false) => {
    try {
      await fetch(`/api/workspace/agents/${agentId}/halt${force ? '?force=true' : ''}`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAgentData = useCallback(() => {
    fetch(`/api/workspace/conversations/${conversationId}/agents`)
      .then(res => res.json())
      .then((agents) => {
        if (!Array.isArray(agents)) {
          console.error('Expected array of agents, got:', agents);
          return;
        }
        const newNodes: Node[] = [{
          id: 'user',
          type: 'default',
          position: { x: 0, y: 0 },
          data: { label: <div className="font-bold text-sm px-4 py-2">Human User</div> },
          style: { background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px' }
        }];
        const newEdges: Edge[] = [];

        agents.forEach((agent: AgentInstance) => {
          newNodes.push({
            id: agent.id,
            type: 'default',
            position: { x: 0, y: 0 },
            data: { 
              status: agent.status,
              label: (
                <div className="flex flex-col items-center relative group w-[180px] h-[80px] justify-center">
                  <div className="font-bold text-sm truncate w-full text-center">{agent.template.name}</div>
                  <div className="text-xs opacity-80 truncate w-full text-center">{agent.template.role}</div>
                  <div className={`mt-2 text-[10px] px-2 py-1 rounded-full ${agent.status === 'RUNNING' ? 'bg-green-500' : agent.status === 'ERROR' ? 'bg-red-500' : agent.status === 'HALTED' ? 'bg-yellow-500' : agent.status === 'IDLE' ? 'bg-blue-500' : 'bg-zinc-700'}`}>
                    {agent.status}
                  </div>
                  {agent.status === 'RUNNING' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleMicroHalt(agent.id); }}
                      className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Halt Agent"
                    >
                      X
                    </button>
                  )}
                </div>
              )
            },
            style: { 
              background: '#18181b', 
              color: 'white', 
              border: agent.status === 'RUNNING' ? '2px solid #22c55e' : '1px solid #3f3f46', 
              borderRadius: '8px' 
            }
          });

          if (agent.parentInstanceId) {
            newEdges.push({
              id: `${agent.parentInstanceId}-${agent.id}`,
              source: agent.parentInstanceId,
              target: agent.id,
              type: 'smoothstep',
              animated: agent.status === 'RUNNING',
              style: { stroke: agent.status === 'RUNNING' ? '#22c55e' : '#52525b' }
            });
          } else {
            newEdges.push({
              id: `user-${agent.id}`,
              source: 'user',
              target: agent.id,
              type: 'smoothstep',
              animated: agent.status === 'RUNNING',
              style: { stroke: agent.status === 'RUNNING' ? '#3b82f6' : '#52525b' }
            });
          }
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setLoading(false);
      })
      .catch(console.error);
  }, [conversationId, setNodes, setEdges]);

  // Live Feed logic
  const lastLogDate = useRef<string | null>(null);

  const loadLogs = useCallback(async (agentId: string, isIncremental: boolean = false) => {
    try {
      let url = `/api/workspace/agents/${agentId}/logs`;
      if (isIncremental && lastLogDate.current) {
        url += `?since=${lastLogDate.current}`;
      }
      
      const res = await fetch(url);
      const logs = await res.json();
      
      if (logs.length > 0) {
        lastLogDate.current = logs[logs.length - 1].createdAt;
        if (isIncremental) {
          setLiveLogs(prev => [...prev, ...logs]);
        } else {
          setLiveLogs(logs);
        }
      } else if (!isIncremental) {
        // eslint-disable-next-line
      setLiveLogs([]);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!selectedAgentId) {
      lastLogDate.current = null;
      // eslint-disable-next-line
      setLiveLogs([]);
      return;
    }
    lastLogDate.current = null;
    loadLogs(selectedAgentId, false);
  }, [selectedAgentId, loadLogs]);

  useEffect(() => {
    fetchAgentData();
    // Listen to agent_updates to refresh statuses dynamically and real-time logs
    const eventSource = new EventSource('/api/sse');
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.channel === 'agent_updates' && (payload.payload === conversationId || payload.payload?.id === conversationId)) {
          fetchAgentData();
          if (selectedAgentId) {
            loadLogs(selectedAgentId, true);
          }
        }
      } catch (err) {
        console.error('SSE Parse error:', err);
      }
    };
    return () => eventSource.close();
  }, [conversationId, selectedAgentId, fetchAgentData, loadLogs]);



  const handleFireAgent = async (agentId: string) => {
    try {
      await fetch(`/api/workspace/agents/${agentId}`, { method: 'DELETE' });
      if (selectedAgentId === agentId) setSelectedAgentId(null);
      fetchAgentData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="h-full w-full flex items-center justify-center bg-zinc-950 text-zinc-400">Loading Swarm Map...</div>;
  }

  return (
    <div className="h-full w-full flex relative">
      <div className="flex-1 h-full relative">


        <ReactFlow 
          nodes={nodes} 
          edges={edges} 
          onNodesChange={onNodesChange} 
          onEdgesChange={onEdgesChange} 
          onConnect={onConnect}
          onNodeClick={(e, node) => setSelectedAgentId(node.id)}
          fitView 
          className="bg-zinc-950"
        >
          <Background color="#3f3f46" gap={16} />
        </ReactFlow>
      </div>

      {selectedAgentId && (
        <div className="w-[400px] border-l border-zinc-800 bg-zinc-900 flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="text-white font-bold truncate pr-4">
              {selectedAgentId === 'user' ? 'Human User' : ((nodes.find(n => n.id === selectedAgentId)?.data?.label as React.ReactElement<{children: React.ReactElement<{children: string}>[]}>)?.props?.children[0]?.props?.children || 'Agent Details')}
            </h3>
            <div className="flex gap-2">
              {selectedAgentId !== 'user' && (
                <>
                  <button 
                    onClick={() => handleFireAgent(selectedAgentId)} 
                    className="bg-red-800 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                  >
                    Fire Agent
                  </button>
                  {nodes.find(n => n.id === selectedAgentId)?.data?.status === 'RUNNING' && (
                    <button 
                      onClick={() => handleMicroHalt(selectedAgentId, true)} 
                      className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
                    >
                      Force Unlock
                    </button>
                  )}
                </>
              )}
              <button onClick={() => setSelectedAgentId(null)} className="text-zinc-400 hover:text-white">x</button>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-y-auto font-mono text-xs text-zinc-400 bg-black flex flex-col gap-2">
            {liveLogs.length === 0 ? (
              <div className="animate-pulse text-zinc-600">_ waiting for DB events...</div>
            ) : (
              liveLogs.map(log => (
                <div key={log.id} className="border-b border-zinc-900 pb-1 break-words">
                  {log.content}
                </div>
              ))
            )}
          </div>
          {selectedAgentId !== 'user' && (
            <div className="p-3 bg-zinc-900 border-t border-zinc-800">
              <form onSubmit={sendInlineCommand} className="flex gap-2">
                <input 
                  type="text" 
                  value={inlineCommand}
                  onChange={(e) => setInlineCommand(e.target.value)}
                  placeholder="Direct steering command..." 
                  className="flex-1 bg-black border border-zinc-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <button type="submit" disabled={!inlineCommand.trim()} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 hover:bg-blue-500 transition-colors">
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}











