'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, Puzzle, Eye, Bot, ShieldAlert, Plus, Save } from 'lucide-react';
import { useOSStore } from '@/store/useOSStore';
import { Settings } from 'lucide-react';

export default function SettingsModal() {
  const { isSettingsModalOpen, setSettingsModalOpen } = useOSStore();
  const [activeTab, setActiveTab] = useState('overseer');

  if (!isSettingsModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div className="border border-zinc-800 rounded-xl w-[900px] h-[650px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" style={{ backgroundColor: 'var(--modal-bg, #09090b)' }}>
        
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings size={20} className="text-blue-400" /> Settings
          </h2>
          <button 
            onClick={() => setSettingsModalOpen(false)}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col py-4 gap-1 shrink-0 overflow-y-auto">
            <TabButton id="overseer" icon={<ShieldAlert size={16}/>} label="The Overseer" active={activeTab} set={setActiveTab} />
            <TabButton id="agents" icon={<Bot size={16}/>} label="Global Agents" active={activeTab} set={setActiveTab} />
            <TabButton id="api_keys" icon={<Settings size={16}/>} label="API Keys" active={activeTab} set={setActiveTab} />
            <TabButton id="mcp" icon={<Server size={16}/>} label="MCP Servers" active={activeTab} set={setActiveTab} />
            <TabButton id="plugins" icon={<Puzzle size={16}/>} label="Plugins" active={activeTab} set={setActiveTab} />
            <TabButton id="appearance" icon={<Eye size={16}/>} label="Appearance" active={activeTab} set={setActiveTab} />
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-zinc-950 p-6 overflow-y-auto relative">
            {activeTab === 'overseer' && <OverseerSettings />}
            {activeTab === 'agents' && <AgentSettings />}
            {activeTab === 'api_keys' && <ApiKeysSettings />}
            {activeTab === 'mcp' && <MCPSettings />}
            {activeTab === 'plugins' && <PluginSettings />}
            {activeTab === 'appearance' && <AppearanceSettings />}
          </div>
        </div>

      </div>
    </div>
  );
}

function TabButton({ id, icon, label, active, set }: { id: string, icon: React.ReactNode, label: string, active: string, set: (id: string) => void }) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => set(id)}
      className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
        isActive ? 'bg-blue-600/10 text-blue-400 border-r-2 border-blue-500' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function OverseerSettings() {
  const [enabled, setEnabled] = useState(true);
  const [strategy, setStrategy] = useState('cron');
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/mcp').then(r => r.json()).then(data => {
      if (data.overseer) {
        setEnabled(data.overseer.enabled);
        setStrategy(data.overseer.strategy);
        setThreshold(data.overseer.threshold);
      }
      setLoading(false);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    try {
      await fetch('/api/settings/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overseer: { enabled, strategy, threshold: Number(threshold) } })
      });
    } catch(err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-zinc-500">Loading...</div>;

  return (
    <div className="text-zinc-300">
      <h3 className="text-lg font-bold text-white mb-4">Overseer Configuration</h3>
      <div className="space-y-4">
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="form-checkbox h-5 w-5 text-blue-500 rounded bg-zinc-800 border-zinc-700" 
              checked={enabled} 
              onChange={e => setEnabled(e.target.checked)} 
            />
            <span className="font-medium text-white">Enable Global Overseer</span>
          </label>
          <p className="text-xs text-zinc-500 mt-2 ml-8">
            The background watchdog that monitors swarm health and intervenes if agents drift off course. This controls the instrumentation hook behavior.
          </p>
        </div>

        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <h4 className="font-semibold text-white mb-3">Trigger Strategy</h4>
          <select 
            value={strategy}
            onChange={e => setStrategy(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300 focus:border-blue-500 outline-none mb-4"
          >
            <option value="event">Event-driven (Every X messages) - Token Efficient</option>
            <option value="cron">Time-driven (Every 60s) - Real-time Polling</option>
          </select>

          <h4 className="font-semibold text-white mb-3">Threshold</h4>
          <input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300 focus:border-blue-500 outline-none" />
        </div>
        
        <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-bold w-full">Save Changes</button>
      </div>
    </div>
  );
}

function AgentSettings() {
  const [agents, setAgents] = useState<Array<{id: string; name: string; role: string; systemPrompt?: string; status?: string}>>([]);
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [prompt, setPrompt] = useState('');

  React.useEffect(() => {
    fetch('/api/workspace/agents').then(r => r.json()).then(data => { setAgents(data); setLoading(false); }).catch(e => { console.error(e); setLoading(false); });
  }, []);

  const handleCreate = async () => {
    if(!name || !role || !prompt) return;
    setLoading(true);
    try {
      await fetch('/api/workspace/agents', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, role, systemPrompt: prompt })
      });
      setName(''); setRole(''); setPrompt('');
      const newData = await fetch('/api/workspace/agents').then(r => r.json());
      setAgents(newData);
    } catch(err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="text-zinc-300 flex flex-col h-full">
      <h3 className="text-lg font-bold text-white mb-4">Agent Templates</h3>
      
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
        {loading ? <div className="text-zinc-500 text-sm">Loading agents...</div> : agents.map(a => (
          <div key={a.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded flex justify-between items-start">
            <div>
              <div className="font-bold text-white text-sm">{a.name}</div>
              <div className="text-xs text-blue-400 mb-1">{a.role}</div>
              <div className="text-[10px] text-zinc-500 line-clamp-2">{a.systemPrompt}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg shrink-0">
        <h4 className="font-bold text-white text-sm mb-3">Create New Template</h4>
        <div className="flex gap-2 mb-2">
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white" />
          <input placeholder="Role" value={role} onChange={e => setRole(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white" />
        </div>
        <textarea placeholder="System Prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white mb-2" />
        <button onClick={handleCreate} disabled={loading || !name} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-bold w-full disabled:opacity-50 flex items-center justify-center gap-2">
          <Plus size={14} /> Add Template
        </button>
      </div>
    </div>
  );
}

function MCPSettings() {
  const [servers, setServers] = useState<Record<string, {command?: string; args?: string[]; env?: Record<string, string>; enabled?: boolean}>>({});
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');

  useEffect(() => {
    fetch('/api/settings/mcp').then(r => r.json()).then(data => { setServers(data?.mcpServers || {}); }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if(!name || !command) return;
    setLoading(true);
    try {
      await fetch('/api/settings/mcp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ mcpServers: { [name]: { command, args: [] } } })
      });
      setName(''); setCommand('');
      const newData = await fetch('/api/settings/mcp').then(r => r.json());
      setServers(newData?.mcpServers || {});
    } catch(err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="text-zinc-300 flex flex-col h-full">
      <h3 className="text-lg font-bold text-white mb-4">MCP Servers (.trans4mers.config.json)</h3>
      
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
        {loading ? <div className="text-zinc-500 text-sm">Loading config...</div> : Object.entries(servers).length === 0 ? <div className="text-zinc-500 text-sm">No MCP servers configured.</div> : Object.entries(servers).map(([key, srv]: [string, {command?: string}]) => (
          <div key={key} className="bg-zinc-900 border border-zinc-800 p-3 rounded">
            <div className="font-bold text-white text-sm">{key}</div>
            <div className="text-xs text-emerald-400 mt-1 font-mono">Command: {srv.command}</div>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg shrink-0">
        <h4 className="font-bold text-white text-sm mb-3">Add Server</h4>
        <div className="flex gap-2 mb-2">
          <input placeholder="Server Name (e.g. filesystem)" value={name} onChange={e => setName(e.target.value)} className="w-1/3 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white" />
          <input placeholder="Command (e.g. npx @modelcontextprotocol/server-filesystem)" value={command} onChange={e => setCommand(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white" />
        </div>
        <button onClick={handleCreate} disabled={loading || !name} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-bold w-full disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={14} /> Update Config File
        </button>
      </div>
    </div>
  );
}

function PluginSettings() {
  const [plugins, setPlugins] = useState<Record<string, {command?: string; args?: string[]; env?: Record<string, string>; enabled?: boolean}>>({});
  const [loading, setLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');

  useEffect(() => {
    fetch('/api/settings/mcp').then(r => r.json()).then(data => { setPlugins(data?.plugins || {}); setLoading(false); }).catch(console.error);
  }, []);

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    const updated = { [key]: { ...plugins[key], enabled: !currentEnabled } };
    try {
      await fetch('/api/settings/mcp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ plugins: updated })
      });
      setPlugins({ ...plugins, ...updated });
    } catch(err) { console.error(err); }
  };

  const handleCreate = async () => {
    if(!name || !command) return;
    setLoading(true);
    const newPlugin = { [name]: { command, args: [], enabled: true } };
    try {
      await fetch('/api/settings/mcp', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ plugins: newPlugin })
      });
      setPlugins({ ...plugins, ...newPlugin });
      setName(''); setCommand('');
    } catch(err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div className="text-zinc-300 flex flex-col h-full">
      <h3 className="text-lg font-bold text-white mb-4">Plugins</h3>
      
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2">
        {loading ? <div className="text-zinc-500 text-sm">Loading plugins...</div> : Object.entries(plugins).length === 0 ? <div className="text-zinc-500 text-sm">No plugins configured.</div> : Object.entries(plugins).map(([key, p]: [string, {name?: string; version?: string; enabled?: boolean; command?: string}]) => (
          <div key={key} className="bg-zinc-900 border border-zinc-800 p-3 rounded flex justify-between items-center">
            <div>
              <div className="font-bold text-white text-sm">{key}</div>
              <div className="text-xs text-emerald-400 mt-1 font-mono">{p.command}</div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={p.enabled === true} onChange={() => handleToggle(key, p.enabled || false)} className="form-checkbox h-4 w-4 text-blue-500 rounded bg-zinc-800 border-zinc-700" />
              <span className="text-xs">Enabled</span>
            </label>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg shrink-0">
        <h4 className="font-bold text-white text-sm mb-3">Add Plugin</h4>
        <div className="flex gap-2 mb-2">
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-1/3 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white" />
          <input placeholder="Command" value={command} onChange={e => setCommand(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded p-2 text-xs text-white" />
        </div>
        <button onClick={handleCreate} disabled={loading || !name} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded text-xs font-bold w-full flex items-center justify-center gap-2">
          <Plus size={14} /> Add Plugin
        </button>
      </div>
    </div>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useState({
    mode: 'dark',
    colors: {
      leftPane: '#19171D',
      rightPane: '#19171D',
      centerPane: '#09090b',
      promptBox: '#18181b',
      modalBg: '#09090b',
      textColor: '#ffffff'
    }
  });

  useEffect(() => {
    const saved = localStorage.getItem('trans4mers_theme');
    if (saved) {
      setTheme(JSON.parse(saved));
    }
  }, []);

  const applyColors = (t: { colors: { leftPane: string; rightPane: string; centerPane: string; promptBox: string; modalBg: string; textColor: string; }; mode: string }) => {
    document.documentElement.style.setProperty('--left-pane', t.colors!.leftPane);
    document.documentElement.style.setProperty('--right-pane', t.colors!.rightPane);
    document.documentElement.style.setProperty('--center-pane', t.colors!.centerPane);
    document.documentElement.style.setProperty('--prompt-box', t.colors!.promptBox);
    document.documentElement.style.setProperty('--modal-bg', t.colors!.modalBg);
    document.documentElement.style.setProperty('--text-color', t.colors!.textColor);
  };

  const saveTheme = (newTheme: { colors: { leftPane: string; rightPane: string; centerPane: string; promptBox: string; modalBg: string; textColor: string; }; mode: string }) => {
    setTheme(newTheme);
    localStorage.setItem('trans4mers_theme', JSON.stringify(newTheme));
    applyColors(newTheme);
  };

  const handleColorChange = (key: string, val: string) => {
    const newTheme = { ...theme, colors: { ...theme.colors, [key]: val } };
    saveTheme(newTheme);
  };

  return (
    <div className="text-zinc-300">
      <h3 className="text-lg font-bold text-white mb-4">Appearance Settings</h3>
      <div className="space-y-4">
        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 flex justify-between items-center">
          <span className="text-sm font-medium">Dark Mode</span>
          <button 
            type="button"
            role="switch"
            aria-checked={theme.mode === 'dark'}
            className={`w-11 h-6 rounded-full flex items-center px-1 cursor-pointer transition-colors ${theme.mode === 'dark' ? 'bg-blue-600 justify-end' : 'bg-zinc-600 justify-start'}`} 
            onClick={() => saveTheme({...theme, mode: theme.mode === 'dark' ? 'light' : 'dark'})}
          >
            <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
          </button>
        </div>

        <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
          <h4 className="font-semibold text-white mb-3">Custom Colors</h4>
          <div className="space-y-2">
            {Object.entries(theme.colors).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-sm capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <input type="color" value={v as string} onChange={e => handleColorChange(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeysSettings() {
  const [keys, setKeys] = useState({ openai: '', anthropic: '', browserbase: '' });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/mcp').then(r => r.json()).then(data => {
      if (data.apiKeys) setKeys({ openai: data.apiKeys.openai || '', anthropic: data.apiKeys.anthropic || '', browserbase: data.apiKeys.browserbase || '' });
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    try {
      await fetch('/api/settings/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys: keys })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-zinc-500">Loading API keys...</div>;

  return (
    <div className="text-zinc-300">
      <h3 className="text-lg font-bold text-white mb-4">API Keys Configuration</h3>
      <p className="text-sm text-zinc-400 mb-6">These keys are securely stored in your isolated session environment on the server to power the ReAct loop.</p>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">OpenAI API Key</label>
          <input type="password" value={keys.openai} onChange={e => setKeys({...keys, openai: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white" placeholder="sk-..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Anthropic API Key</label>
          <input type="password" value={keys.anthropic} onChange={e => setKeys({...keys, anthropic: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white" placeholder="sk-ant-..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Browserbase API Key (for Puppeteer MCP)</label>
          <input type="password" value={keys.browserbase} onChange={e => setKeys({...keys, browserbase: e.target.value})} className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-white" placeholder="bb_live_..." />
        </div>
        <div className="flex justify-end pt-4">
          <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium flex items-center gap-2">
            <Save size={16} /> Save Keys {saved && <span className="text-xs ml-2 text-green-300">Saved!</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

