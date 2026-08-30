'use client';

import React, { useState } from 'react';
import { useOSStore, RightPaneState } from '@/store/useOSStore';
import { X, FileText, Terminal, UploadCloud, CheckSquare, PanelRight } from 'lucide-react';
import dynamic from 'next/dynamic';
import TerminalWidget from './TerminalWidget';
import { useParams } from 'next/navigation';

const MonacoEditor = dynamic(() => import('@monaco-editor/react').then(mod => mod.default), { ssr: false });

export default function RightSidebar() {
  const { rightPaneState, setRightPaneState, activeFilePath, setActiveFile, closeRightSidebar } = useOSStore();
  const params = useParams();
  const conversationId = params?.conversationId as string;
  const projectId = params?.projectId as string;
  
  const [codeContent, setCodeContent] = useState('// Loading...');
  const [fileTree, setFileTree] = useState<{name: string, path: string}[]>([]);
  const [showToast, setShowToast] = useState(false);

  React.useEffect(() => {
    setActiveFile(null);
    setRightPaneState('files');
  }, [conversationId, setActiveFile, setRightPaneState]);

  const handleSave = async () => {
    if (!activeFilePath) return;
    try {
      const res = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: activeFilePath, content: codeContent })
      });
      if (res.ok) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      } else {
        console.error("Save failed");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch the file tree
  React.useEffect(() => {
    if (rightPaneState === 'files') {
      fetch('/api/workspace?action=list_files')
        .then(r => r.json())
        .then(data => { if (data.files) setFileTree(data.files); })
        .catch(console.error);
    }
  }, [rightPaneState]);

  // Fetch the active file content
  React.useEffect(() => {
    if (activeFilePath) {
      setCodeContent('// Loading...');
      fetch(`/api/workspace?action=read_file&path=${encodeURIComponent(activeFilePath)}`)
        .then(r => r.json())
        .then(data => { setCodeContent(data.content || ''); })
        .catch(() => setCodeContent('// Error loading file'));
    }
  }, [activeFilePath]);

  const renderTabs = () => {
    const tabs: { id: RightPaneState, label: string, icon: React.ReactNode }[] = [
      { id: 'files', label: 'Files', icon: <FileText size={14} /> },
      { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={14} /> },
      { id: 'terminal', label: 'Terminal', icon: <Terminal size={14} /> },
      { id: 'uploads', label: 'Uploads', icon: <UploadCloud size={14} /> }
    ];

    return (
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setRightPaneState(tab.id);
            }}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${rightPaneState === tab.id ? 'border-blue-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    switch (rightPaneState) {
      case 'editor':
        return (
          <div className="flex-1 flex flex-col h-full bg-[#1e1e1e]">
            <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-300">
              <span className="font-mono truncate">{activeFilePath}</span>
              <div className="flex items-center gap-2">
                {showToast && <span className="text-green-400">Saved!</span>}
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded">Save</button>
                <button onClick={() => { setActiveFile(null); setRightPaneState('files'); }} className="hover:text-white ml-2"><X size={14} /></button>
              </div>
            </div>
            <div className="flex-1" onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
              }
            }}>
              <MonacoEditor
                height="100%"
                theme="vs-dark"
                path={activeFilePath || 'unknown.ts'}
                value={codeContent}
                onChange={(val) => setCodeContent(val || '')}
                options={{ minimap: { enabled: false }, fontSize: 12, wordWrap: 'on' }}
              />
            </div>
          </div>
        );
      case 'files':
        return (
          <div className="p-4 text-zinc-400 text-sm">
            <h3 className="text-white font-medium mb-2">Workspace Explorer</h3>
            <div className="space-y-1">
              {fileTree.length === 0 ? (
                <div className="text-xs text-zinc-500">No artifacts found in project.</div>
              ) : (
                fileTree.map(file => (
                  <div 
                    key={file.path}
                    className="flex items-center gap-2 cursor-pointer hover:text-white hover:bg-zinc-800 p-1 rounded font-mono text-xs truncate"
                    onClick={() => setActiveFile(file.path)}
                  >
                    <FileText size={14} className="shrink-0" /> {file.name}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'terminal':
        return <TerminalWidget />;
      case 'tasks':
        return <TasksTab conversationId={conversationId} />;
      case 'uploads':
        return <UploadsTab conversationId={conversationId} projectId={projectId} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full border-l border-zinc-800 text-sm" style={{ backgroundColor: 'var(--right-pane, #09090b)' }}>
      <div className="flex items-center justify-between p-2 border-b border-zinc-800 shrink-0">
        <h2 className="text-xs font-bold text-zinc-500 tracking-wider">WORKSPACE</h2>
      </div>
      
      {renderTabs()}
      
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
}

function TasksTab({ conversationId }: { conversationId: string }) {
  const [agents, setAgents] = useState<Array<{id: string; name: string; role: string; status?: string}>>([]);
  React.useEffect(() => {
    if (!conversationId) return;
    fetch(`/api/workspace/conversations/${conversationId}/agents`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAgents(data);
        } else {
          setAgents([]);
        }
      })
      .catch(() => setAgents([]));
  }, [conversationId]);

  return (
    <div className="p-4 text-zinc-400 text-sm">
      <h3 className="text-white font-medium mb-3">Active Background Tasks</h3>
      {agents.length === 0 ? (
        <div className="text-xs text-zinc-500">No active background tasks.</div>
      ) : (
        <div className="space-y-2">
          {agents.map(a => (
            <div key={a.id} className="bg-zinc-900 border border-zinc-800 p-2 rounded flex items-center justify-between">
              <div>
                <div className="text-white text-xs font-bold">{a.name || a.role || 'Agent Process'}</div>
                <div className="text-[10px] text-zinc-500">{a.id}</div>
              </div>
              <div className={`text-[10px] font-mono ${a.status === 'RUNNING' ? 'text-green-400 animate-pulse' : 'text-zinc-400'}`}>
                {a.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadsTab({ conversationId, projectId }: { conversationId: string, projectId: string }) {
  const [uploads, setUploads] = useState<{id: string; fileName: string; fileSize: number}[]>([]);

  const fetchUploads = async () => {
    if (!conversationId) return;
    try {
      const res = await fetch(`/api/workspace/uploads?conversationId=${conversationId}`);
      if (res.ok) {
        setUploads(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  React.useEffect(() => {
    fetchUploads();
  }, [conversationId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId || !projectId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId);
    formData.append('projectId', projectId);

    try {
      const res = await fetch('/api/workspace/uploads', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchUploads();
      } else {
        console.error("Upload failed");
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  return (
    <div className="p-4 text-zinc-400 text-sm">
      <h3 className="text-white font-medium mb-3">Project Assets & Uploads</h3>
      <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-lg text-center border-dashed mb-4 relative">
        <UploadCloud size={24} className="mx-auto text-zinc-600 mb-2" />
        <p className="text-xs text-zinc-500 mb-3">Upload files to your local bucket</p>
        <input 
          type="file" 
          onChange={handleUpload} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
        />
        <button className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1 rounded transition-colors pointer-events-none">Select Files</button>
      </div>

      <div className="space-y-2">
        {uploads.length === 0 ? (
          <div className="text-xs text-zinc-500">No uploads yet.</div>
        ) : (
          uploads.map(u => (
            <div key={u.id} className="bg-zinc-900 border border-zinc-800 p-2 rounded flex items-center justify-between">
              <div className="truncate pr-2">
                <div className="text-white text-xs truncate">{u.fileName}</div>
                <div className="text-[10px] text-zinc-500">{(u.fileSize / 1024).toFixed(1)} KB</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
