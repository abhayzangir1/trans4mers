'use client';

import React, { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MonacoEditorModalProps {
  filePath: string | null;
  onClose: () => void;
}

export function MonacoEditorModal({ filePath, onClose }: MonacoEditorModalProps) {
  const [content, setContent] = useState<string>('Loading...');

  useEffect(() => {
    if (filePath) {
      setContent('Loading...');
      fetch(`/api/workspace?path=${encodeURIComponent(filePath)}`)
        .then(res => res.json())
        .then(data => setContent(data.content || '// Empty or not found'))
        .catch(e => setContent(`// Error loading file: ${e.message}`));
    }
  }, [filePath]);

  if (!filePath) return null;

  const getLanguage = (path: string) => {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    if (path.endsWith('.md')) return 'markdown';
    if (path.endsWith('.css')) return 'css';
    if (path.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  return (
    <Dialog open={!!filePath} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col bg-neutral-900 border-neutral-700 p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-neutral-800 shrink-0">
          <DialogTitle className="text-neutral-200 font-mono text-sm">{filePath}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            defaultLanguage={getLanguage(filePath)}
            theme="vs-dark"
            value={content}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
