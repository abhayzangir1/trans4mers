'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Folder, MessageSquare, PlusCircle, Settings, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useOSStore } from '@/store/useOSStore';
import NewProjectModal from './modals/NewProjectModal';
import NewConversationModal from './modals/NewConversationModal';

interface Conversation {
  id: string;
  title: string | null;
  status: string;
}

interface Project {
  id: string;
  name: string;
  directoryPath: string;
  conversations: Conversation[];
}

export default function LeftSidebar() {
  const router = useRouter();
  const params = useParams();
  const { setSettingsModalOpen } = useOSStore();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [isConvModalOpen, setConvModalOpen] = useState(false);
  const [activeProjectIdForConv, setActiveProjectIdForConv] = useState<string | null>(null);

  const fetchProjects = (signal?: AbortSignal) => {
    fetch(`/api/workspace/projects?_t=${Date.now()}`, { signal, cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          console.error('Expected array of projects, got:', data);
          setProjects([]);
          setLoading(false);
          return;
        }
        setProjects(data);
        const initialExpanded: Record<string, boolean> = {};
        data.forEach((p: Project) => {
          initialExpanded[p.id] = true;
        });
        setExpandedProjects(initialExpanded);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('Failed to fetch projects', err);
        setProjects([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchProjects(controller.signal);
    return () => controller.abort();
  }, []);

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleOpenConvModal = (projectId: string) => {
    setActiveProjectIdForConv(projectId);
    setConvModalOpen(true);
  };

  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (deletingProjectId === projectId) return;
    if (!window.confirm(`Are you sure you want to delete the project "${projectName}" and all its conversations?`)) {
      return;
    }
    setDeletingProjectId(projectId);
    try {
      const res = await fetch(`/api/workspace/projects?projectId=${projectId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (params.projectId === projectId) {
          router.push('/workspace');
        }
        fetchProjects();
      } else {
        console.error('Failed to delete project');
      }
    } catch (e) {
      console.error('Error deleting project:', e);
    } finally {
      setDeletingProjectId(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string, conversationTitle: string) => {
    if (deletingConvId === conversationId) return;
    if (!window.confirm(`Are you sure you want to delete the conversation "${conversationTitle}"?`)) {
      return;
    }
    setDeletingConvId(conversationId);
    try {
      const res = await fetch(`/api/workspace/conversations/${conversationId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (params.conversationId === conversationId) {
          router.push('/workspace');
        }
        fetchProjects();
      } else {
        console.error('Failed to delete conversation');
      }
    } catch (e) {
      console.error('Error deleting conversation:', e);
    } finally {
      setDeletingConvId(null);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-zinc-800 text-sm" style={{ backgroundColor: 'var(--left-pane, #09090b)' }}>
      <div className="p-4 border-b border-zinc-800">
        <h2 className="font-semibold text-zinc-300 tracking-wide uppercase text-xs mb-3 flex items-center">
          <img src="/trans4mers-logo.png" alt="trans4mers" className="h-6 w-auto object-contain" />
        </h2>
        <button 
          onClick={() => setProjectModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-1.5 px-3 rounded-md transition-colors"
        >
          <PlusCircle size={16} />
          New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="text-zinc-500 text-center py-4">Loading workspace...</div>
        ) : projects.length === 0 ? (
          <div className="text-zinc-500 text-center py-4 text-xs">No projects found. Create one to begin.</div>
        ) : (
          projects.map(project => (
            <div key={project.id} className="mb-2">
              <div 
                className="flex items-center justify-between p-2 hover:bg-zinc-900 rounded cursor-pointer group text-zinc-300"
                onClick={() => toggleProject(project.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedProjects[project.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Folder size={14} className="text-blue-400" />
                  <span className="font-medium truncate max-w-[150px]" title={project.name}>{project.name}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenConvModal(project.id); }}
                    className="hover:text-white"
                    title="New Conversation"
                  >
                    <PlusCircle size={14} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id, project.name); }}
                    className="hover:text-red-400 text-zinc-500"
                    title="Delete Project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {expandedProjects[project.id] && (
                <div className="ml-6 space-y-0.5 mt-0.5 border-l border-zinc-800 pl-2">
                  {project.conversations.map(conv => (
                    <div 
                      key={conv.id}
                      onClick={() => router.push(`/workspace/${project.id}/${conv.id}`)}
                      className={`flex items-center justify-between p-1.5 rounded cursor-pointer group ${params.conversationId === conv.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MessageSquare size={12} className="shrink-0" />
                        <span className="truncate">{conv.title || 'Untitled'}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id, conv.title || 'Untitled'); }}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-zinc-500 transition-opacity shrink-0"
                        title="Delete Conversation"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-zinc-800">
        <button 
          onClick={() => setSettingsModalOpen(true)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors w-full p-2 hover:bg-zinc-900 rounded"
        >
          <Settings size={16} />
          App Settings
        </button>
      </div>

      <NewProjectModal 
        isOpen={isProjectModalOpen} 
        onClose={() => setProjectModalOpen(false)} 
        onSuccess={fetchProjects} 
      />
      {activeProjectIdForConv && (
        <NewConversationModal 
          isOpen={isConvModalOpen} 
          onClose={() => {
            setConvModalOpen(false);
            fetchProjects();
          }} 
          projectId={activeProjectIdForConv} 
        />
      )}
    </div>
  );
}
