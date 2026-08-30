'use client';

import React, { useEffect, useState } from 'react';
import { Panel, Group, Separator, usePanelRef } from 'react-resizable-panels';
import { useOSStore } from '@/store/useOSStore';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import SettingsModal from './SettingsModal';
import { useParams } from 'next/navigation';
import { PanelLeft, PanelRight, MessageSquare, Network } from 'lucide-react';

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const { 
    isLeftSidebarOpen, 
    isRightSidebarOpen, 
    toggleLeftSidebar, 
    toggleRightSidebar, 
    closeLeftSidebar,
    openLeftSidebar,
    closeRightSidebar,
    openRightSidebar,
    centerPaneTab, 
    setCenterPaneTab 
  } = useOSStore();
  
  const params = useParams();
  const conversationId = params?.conversationId as string;
  const [metadata, setMetadata] = useState<{ projectName: string, title: string | null } | null>(null);

  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();

  useEffect(() => {
    if (conversationId) {
      fetch(`/api/workspace/conversations/` + conversationId)
        .then(res => res.json())
        .then(data => setMetadata(data))
        .catch(console.error);
    }
  }, [conversationId]);

  // Restore saved theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('trans4mers_theme');
    if (saved) {
      try {
        const theme = JSON.parse(saved);
        if (theme.colors) {
          const root = document.documentElement;
          if (theme.colors.leftPane) root.style.setProperty('--left-pane', theme.colors.leftPane);
          if (theme.colors.rightPane) root.style.setProperty('--right-pane', theme.colors.rightPane);
          if (theme.colors.centerPane) root.style.setProperty('--center-pane', theme.colors.centerPane);
          if (theme.colors.promptBox) root.style.setProperty('--prompt-box', theme.colors.promptBox);
          if (theme.colors.modalBg) root.style.setProperty('--modal-bg', theme.colors.modalBg);
          if (theme.colors.textColor) root.style.setProperty('--text-color', theme.colors.textColor);
        }
      } catch (e) {
        console.error('Failed to restore theme:', e);
      }
    }
  }, []);

  // Sync state to panels
  useEffect(() => {
    const panel = leftPanelRef.current;
    if (panel) {
      const size = panel.getSize().asPercentage;
      if (isLeftSidebarOpen && size < 1) panel.resize("20%");
      else if (!isLeftSidebarOpen && size >= 1) panel.resize("0%");
    }
  }, [isLeftSidebarOpen, leftPanelRef]);

  useEffect(() => {
    const panel = rightPanelRef.current;
    if (panel) {
      const size = panel.getSize().asPercentage;
      if (isRightSidebarOpen && size < 1) panel.resize("25%");
      else if (!isRightSidebarOpen && size >= 1) panel.resize("0%");
    }
  }, [isRightSidebarOpen, rightPanelRef]);

  return (
    <div className="flex h-screen w-screen bg-zinc-950 overflow-hidden text-white">
      <Group orientation="horizontal" className="h-full w-full">
        
        {/* Left Navigation Sidebar */}
        <Panel 
          panelRef={leftPanelRef}
          id="left" 
          defaultSize="20" 
          minSize="0" 
          maxSize="30" 
          onResize={(size) => {
            if (size.asPercentage < 1) {
              closeLeftSidebar();
            } else {
              openLeftSidebar();
            }
          }}
          className="h-full"
        >
          <div className="w-full h-full overflow-hidden">
            <LeftSidebar />
          </div>
        </Panel>
        
        <Separator className={`w-1 bg-zinc-800 hover:bg-blue-500 transition-colors cursor-col-resize`} />

        {/* Center Pane */}
        <Panel id="center" minSize="10" className="flex flex-col h-full" style={{ backgroundColor: 'var(--center-pane, #09090b)' }}>
          {/* Global Header Inside Center Pane */}
          <div className="h-12 border-b border-zinc-800 bg-[#19171D] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={toggleLeftSidebar} className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors" title="Toggle Left Sidebar">
                <PanelLeft size={18} />
              </button>
              <div className="text-sm font-semibold text-zinc-300">
                {metadata ? metadata.projectName + ' / ' + (metadata.title || 'Conversation') : 'Trans4mers / Agent Workspace'}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex bg-zinc-900 rounded-md p-1 border border-zinc-800">
                <button
                  onClick={() => setCenterPaneTab('slack')}
                  className={"flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-sm transition-colors " + (centerPaneTab === 'slack' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200')}
                >
                  <MessageSquare size={14} /> Slack
                </button>
                <button
                  onClick={() => setCenterPaneTab('map')}
                  className={"flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-sm transition-colors " + (centerPaneTab === 'map' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200')}
                >
                  <Network size={14} /> Map
                </button>
              </div>
              <button onClick={toggleRightSidebar} className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors" title="Toggle Right Sidebar">
                <PanelRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {children}
          </div>
        </Panel>

        {/* Right Workspace Sidebar */}
        <Separator className={`w-1 bg-zinc-800 hover:bg-blue-500 transition-colors cursor-col-resize`} />
        
        <Panel 
          panelRef={rightPanelRef}
          id="right" 
          defaultSize="25" 
          minSize="0" 
          maxSize="40" 
          onResize={(size) => {
            if (size.asPercentage < 1) {
              closeRightSidebar();
            } else {
              openRightSidebar();
            }
          }}
          className="h-full"
        >
          <div className="w-full h-full overflow-hidden">
            <RightSidebar />
          </div>
        </Panel>

      </Group>

      <SettingsModal />
    </div>
  );
}



