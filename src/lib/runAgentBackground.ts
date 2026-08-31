import http from 'http';

export function triggerBackgroundAgent(agentId: string, prompt: string, channelId: string) {
  const postData = JSON.stringify({ agentId, prompt, channelId });
  const req = http.request({
    hostname: '127.0.0.1',
    port: parseInt(process.env.PORT || '3000', 10),
    path: '/api/internal/run-agent',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  });
  req.on('error', (e) => console.error('Background trigger failed:', e));
  req.write(postData);
  req.end();
}
