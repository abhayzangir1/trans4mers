const URL = 'https://trans4mers-547808710111.us-central1.run.app';

(async () => {
  try {
    console.log('1. Creating Project...');
    let res = await fetch(`${URL}/api/workspace/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Live Cloud Test Project',
        description: 'Testing the live deployment.'
      })
    });
    
    // Get cookies
    const setCookie = res.headers.get('set-cookie');
    const cookie = setCookie ? setCookie.split(';')[0] : '';
    
    const projectRes = await res.json();
    console.log('Project created:', projectRes);

    if (!projectRes.project.id) throw new Error('Project ID missing!');

    console.log('\n2. Creating Boss Agent Template...');
    res = await fetch(`${URL}/api/workspace/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        name: 'Boss Agent',
        description: 'The boss agent that orchestrates the swarm.',
        systemPrompt: 'You are the Boss Agent.',
        model: 'vertexai/gemini-2.5-pro',
        tools: ['browserTool', 'commandTool'],
        isRoot: true,
        projectId: projectRes.project.id
      })
    });
    const agentTemplate = await res.json();
    console.log('Boss Agent Template created:', agentTemplate);

    console.log('\n2b. Creating Coder Agent Template...');
    res = await fetch(`${URL}/api/workspace/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        name: 'Coder Agent',
        description: 'Writes code.',
        systemPrompt: 'You are the Coder Agent.',
        model: 'vertexai/gemini-2.5-pro',
        tools: ['fileSystemTools'],
        isRoot: false,
        projectId: projectRes.project.id
      })
    });
    console.log('Coder Agent Template created:', await res.json());

    console.log('\n3. Creating Conversation...');
    res = await fetch(`${URL}/api/workspace/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({
        projectId: projectRes.project.id,
        title: 'Test Swarm'
      })
    });
    const conversation = await res.json();
    console.log('Conversation created:', conversation);

    if (!conversation.id) throw new Error('Conversation ID missing!');

    console.log('\n3. Triggering Agent Swarm (@Boss Agent hello)...');
    const startTime = Date.now();
    res = await fetch(`${URL}/api/workspace/conversations/${conversation.id}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ prompt: '@Boss Agent hello' })
    });
    const promptRes = await res.json();
    console.log('Prompt trigger response (should be fast):', promptRes, `(Took ${Date.now() - startTime}ms)`);

    console.log('\n4. Listening to SSE for native UI updates...');
    console.log('Since EventSource is not in Node native fetch by default without a library, we will poll the channel API after 12 seconds instead.');
    
    await new Promise(r => setTimeout(r, 12000));
    
    res = await fetch(`${URL}/api/workspace/conversations/${conversation.id}`, { headers: { 'Cookie': cookie }});
    const convData = await res.json();
    console.log('Conversation Data:', JSON.stringify(convData).substring(0, 500));
    const blackboard = convData.channels?.find((c: any) => c.name === 'Shared Blackboard' || c.name === 'shared-blackboard');
    
    if (blackboard) {
      console.log(`Blackboard (${blackboard.id}) found. Checking messages...`);
      res = await fetch(`${URL}/api/workspace/channels/${blackboard.id}/messages`, { headers: { 'Cookie': cookie }});
      const msgs = await res.json();
      console.log(`Found ${msgs.length} messages in blackboard:`);
      msgs.forEach((m: any) => console.log(`[${m.role}] ${m.content.substring(0, 200)}`));
    } else {
      console.log('Blackboard not found. Falling back to all messages via first channel...');
      if (convData.channels && convData.channels.length > 0) {
          res = await fetch(`${URL}/api/workspace/channels/${convData.channels[0].id}/messages`, { headers: { 'Cookie': cookie }});
          const msgs = await res.json();
          msgs.forEach((m: any) => console.log(`[${m.role}] ${m.content.substring(0, 200)}`));
      }
    }

  } catch(e) {
    console.error('Error:', e);
  }
})();
