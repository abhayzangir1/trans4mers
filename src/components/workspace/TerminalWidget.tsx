'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function TerminalWidget({ terminalId = 'default-term' }: { terminalId?: string }) {
  const [history, setHistory] = useState<{ type: 'input' | 'output' | 'error', text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const cmd = input.trim();
    setInput('');
    setHistory(prev => [...prev, { type: 'input', text: `$ ${cmd}` }]);
    setIsExecuting(true);

    try {
      const res = await fetch('/api/pty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: terminalId, action: 'write', data: cmd })
      });

      const data = await res.json();
      if (data.output) {
        setHistory(prev => [...prev, { type: 'output', text: data.output }]);
      } else if (data.error) {
        setHistory(prev => [...prev, { type: 'error', text: data.error }]);
      }
    } catch (err: unknown) {
      setHistory(prev => [...prev, { type: 'error', text: (err as Error).message }]);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="w-full h-full bg-[#18181b] text-[#e4e4e7] p-2 overflow-hidden flex flex-col font-mono text-xs">
      <div className="flex-1 overflow-y-auto mb-2 space-y-1" ref={scrollRef}>
        {history.map((line, i) => (
          <div 
            key={i} 
            className={`whitespace-pre-wrap ${line.type === 'error' ? 'text-red-400' : line.type === 'input' ? 'text-green-400' : 'text-gray-300'}`}
          >
            {line.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex shrink-0 border-t border-zinc-700 pt-2">
        <span className="text-green-400 mr-2">$</span>
        <input
          id="terminal-input"
          name="terminal-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isExecuting}
          className="flex-1 bg-transparent outline-none disabled:opacity-50"
          placeholder="Enter command..."
          autoComplete="off"
          spellCheck="false"
        />
      </form>
    </div>
  );
}
