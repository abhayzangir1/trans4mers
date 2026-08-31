import http from 'http';

export function triggerBackgroundAgent(agentId: string, prompt: string, channelId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  fetch(`${baseUrl}/api/internal/run-agent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
    },
    body: JSON.stringify({ agentId, prompt, channelId })
  }).catch(e => console.error('Background trigger failed:', e));
}
