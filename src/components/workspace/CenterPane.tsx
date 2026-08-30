'use client';

import React from 'react';
import { useOSStore } from '@/store/useOSStore';
import SwarmMap from './SwarmMap';
import SlackMode from './SlackMode';

export default function CenterPane({ conversationId }: { conversationId: string }) {
  const { centerPaneTab } = useOSStore();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-zinc-950">
      <div className="flex-1 w-full h-full">
        {centerPaneTab === 'slack' ? (
          <SlackMode conversationId={conversationId} />
        ) : (
          <SwarmMap conversationId={conversationId} />
        )}
      </div>
    </div>
  );
}
