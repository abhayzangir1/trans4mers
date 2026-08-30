# MANDATORY ENGINEERING RULES FOR THIS PROJECT

You are working on `trans4mers` — an AI agent orchestration platform deployed to **Google Cloud Run** with a **Neon PostgreSQL** database (PgBouncer in Transaction Mode) and **Next.js 15+ App Router**.

**READ THIS ENTIRE FILE BEFORE WRITING ANY CODE. VIOLATING THESE RULES WILL BREAK PRODUCTION.**

---

## ARCHITECTURE CONSTRAINTS (Cloud Run + Neon)

### 1. NO BACKGROUND WORK AFTER HTTP RESPONSE
Cloud Run throttles CPU to ~0% after the HTTP response is sent. **NEVER** do this:
```typescript
// ❌ BANNED — loop will freeze
someAsyncWork().then(...).catch(...);
return NextResponse.json({ ok: true });
```
Instead, keep the HTTP connection alive with a streaming response:
```typescript
// ✅ CORRECT — CPU stays active while stream is open
const stream = new ReadableStream({
  async start(controller) {
    await someAsyncWork((progress) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
    });
    controller.close();
  }
});
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
```

### 2. NO LISTEN/NOTIFY
Neon uses PgBouncer in Transaction Mode. `LISTEN` and `NOTIFY` are **silently dropped**. Never use them. Use database polling instead:
```typescript
// ❌ BANNED
await client.query('LISTEN agent_updates');
// ❌ BANNED
await client.query('SELECT pg_notify($1, $2)', ['agent_updates', payload]);

// ✅ Use polling with timestamps
const changes = await prisma.agentInstance.findMany({
  where: { updatedAt: { gt: lastChecked } }
});
```

### 3. NO IN-MEMORY STATE
Cloud Run scales horizontally. Multiple container instances run simultaneously. In-memory Maps, global variables, and singletons are NOT shared between instances.
```typescript
// ❌ BANNED — only works on the instance that created it
const sessions = new Map<string, Session>();
global.abortControllers = new Map();

// ✅ Use the database for ALL shared state
await prisma.agentInstance.update({
  where: { id },
  data: { haltRequested: true }
});
```

### 4. NO LOCAL FILESYSTEM FOR PERSISTENT DATA
Cloud Run containers are ephemeral. Local filesystem is stored in RAM and wiped on restart.
```typescript
// ❌ BANNED for persistent data
await fs.writeFile('/app/uploads/file.txt', data);
await fs.writeFile('.trans4mers.config.json', config);

// ✅ Use the FileSystem abstraction (src/lib/fileSystem.ts)
import { fileSystem } from '@/lib/fileSystem';
await fileSystem.writeFile('workspace/file.txt', data);

// ✅ Use the database for config
await prisma.settings.upsert({ where: { key }, create: { key, value }, update: { value } });
```

### 5. NO node-pty
`node-pty` requires `/dev/pts` which Cloud Run does not have. Use `child_process.exec` for stateless command execution.

---

## DATABASE RULES

### 6. ALWAYS USE TRANSACTIONS FOR MULTI-STEP OPERATIONS
```typescript
// ❌ BANNED — partial failure = orphaned records
const project = await prisma.project.create({...});
const conversation = await prisma.conversation.create({...});
const channel = await prisma.channel.create({...});

// ✅ CORRECT
const result = await prisma.$transaction(async (tx) => {
  const project = await tx.project.create({...});
  const conversation = await tx.conversation.create({...});
  const channel = await tx.channel.create({...});
  return { project, conversation, channel };
});
```

### 7. ALWAYS USE FINALLY FOR CONNECTION RELEASE
```typescript
// ❌ BANNED — connection leak if query throws
const client = await pool.connect();
await client.query('...');
client.release();

// ✅ CORRECT
const client = await pool.connect();
try {
  await client.query('...');
} finally {
  client.release();
}
```

### 8. USE UPSERT INSTEAD OF FIND-THEN-CREATE
```typescript
// ❌ BANNED — race condition with concurrent requests
let channel = await prisma.channel.findFirst({ where: { name } });
if (!channel) {
  channel = await prisma.channel.create({ data: { name } });
}

// ✅ CORRECT — atomic
const channel = await prisma.channel.upsert({
  where: { conversationId_name: { conversationId, name } },
  create: { conversationId, name },
  update: {},
});
```

### 9. NO N+1 QUERIES
```typescript
// ❌ BANNED
for (const conv of conversations) {
  const msg = await prisma.message.findFirst({ where: { conversationId: conv.id } });
}

// ✅ CORRECT — single query
const messages = await prisma.message.findMany({
  where: { conversationId: { in: conversations.map(c => c.id) } },
  distinct: ['conversationId'],
  orderBy: { createdAt: 'desc' },
});
```

---

## CODE QUALITY RULES

### 10. NEVER USE `any`
```typescript
// ❌ BANNED
export async function GET(request: Request, { params }: any) {
const [data, setData] = useState<any[]>([]);
} catch (error: any) {

// ✅ CORRECT
interface RouteParams { params: Promise<{ id: string }> }
export async function GET(request: Request, props: RouteParams) {
  const { id } = await props.params;
}
const [data, setData] = useState<AgentInstance[]>([]);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
}
```

### 11. NEVER SWALLOW ERRORS
```typescript
// ❌ BANNED
} catch (e) {}
} catch (e) { console.error(e); }

// ✅ CORRECT — return proper HTTP error OR show user-facing feedback
} catch (error: unknown) {
  console.error('[RouteHandler] Operation failed:', error);
  return NextResponse.json(
    { error: 'Operation failed' }, // Don't leak stack traces
    { status: 500 }
  );
}

// ✅ In React components — show toast/notification
} catch (error) {
  toast.error('Failed to save. Please try again.');
}
```

### 12. VALIDATE ALL INPUTS
```typescript
// ❌ BANNED — trusting user input blindly
const { name, path } = await request.json();

// ✅ CORRECT
const body = await request.json();
if (!body.name || typeof body.name !== 'string' || body.name.length > 255) {
  return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
}
```

### 13. NEXT.JS 15+ PARAMS ARE PROMISES
```typescript
// ❌ BANNED — params is a Promise in Next.js 15+
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const data = await prisma.find({ where: { id: params.id } });
}

// ✅ CORRECT
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const data = await prisma.find({ where: { id } });
}
```

### 14. CLEAN UP RESOURCES IN useEffect
```typescript
// ❌ BANNED — memory leak
useEffect(() => {
  const interval = setInterval(pollData, 3000);
  const eventSource = new EventSource('/api/sse');
}, []);

// ✅ CORRECT
useEffect(() => {
  let cancelled = false;
  const interval = setInterval(pollData, 3000);
  const eventSource = new EventSource('/api/sse');
  
  return () => {
    cancelled = true;
    clearInterval(interval);
    eventSource.close();
  };
}, []);
```

---

## REFERENCE FILES

Before modifying any file, ALWAYS read the implementation plan at:
`C:\Users\abhay\.gemini\antigravity\brain\ccb339aa-c279-4ace-a875-9eb54c4ee7e3\implementation_plan.md`

Before writing critical code (Phases 1-4), ALWAYS read the exact code reference at:
`C:\Users\abhay\.gemini\antigravity\brain\ccb339aa-c279-4ace-a875-9eb54c4ee7e3\critical_code_reference.md`

The code reference contains **exact, tested replacement code** for the hardest fixes. Copy it exactly — do not improvise.
