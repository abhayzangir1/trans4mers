import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import { getSessionId } from '@/lib/session';

interface McpConfig {
  mcpServers?: Record<string, unknown>;
  plugins?: Record<string, unknown>;
  userId?: string;
  availableModels?: Array<{ id: string; name: string }>;
  overseer?: Record<string, unknown>;
  theme?: Record<string, unknown>;
  apiKeys?: Record<string, string>;
}

async function getConfig(): Promise<McpConfig> {
  try {
    const sessionId = await getSessionId();
    const settingsKey = `mcp_config_${sessionId}`;
    
    const record = await prisma.settings.findUnique({
      where: { key: settingsKey }
    });

    if (record && record.value) {
      return record.value as unknown as McpConfig;
    } else {
      const uuid = crypto.randomUUID ? crypto.randomUUID() : 'default-user-id';
      return { 
        mcpServers: {}, 
        plugins: {}, 
        userId: uuid,
        apiKeys: {},
        availableModels: [
          { id: 'vertexai/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
          { id: 'vertexai/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
        ],
        overseer: { enabled: true, strategy: 'cron', threshold: 5 },
        theme: { mode: 'dark' }
      };
    }
  } catch (err: unknown) {
    console.error('Failed to parse config:', err);
    throw err;
  }
}

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {
    console.error('Error in GET /api/settings/mcp:', error);
    return NextResponse.json({ error: 'Failed to read config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionId = await getSessionId();
    const settingsKey = `mcp_config_${sessionId}`;
    const payload = await request.json();
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const config = await getConfig();
    
    // Deep merge payload into config
    const merged: McpConfig = { ...config };
    
    if (payload.mcpServers) merged.mcpServers = { ...merged.mcpServers, ...payload.mcpServers };
    if (payload.plugins) merged.plugins = { ...merged.plugins, ...payload.plugins };
    if (payload.overseer) merged.overseer = { ...merged.overseer, ...payload.overseer };
    if (payload.theme) merged.theme = { ...merged.theme, ...payload.theme };
    if (payload.apiKeys) merged.apiKeys = { ...merged.apiKeys, ...payload.apiKeys };
    
    if (payload.name && payload.command) {
        if (!merged.mcpServers) merged.mcpServers = {};
        merged.mcpServers[payload.name] = {
            command: payload.command,
            args: Array.isArray(payload.args) ? payload.args : [],
            env: typeof payload.env === 'object' ? payload.env : {}
        };
    }

    await prisma.settings.upsert({
      where: { key: settingsKey },
      create: { key: settingsKey, value: merged as unknown as import("@prisma/client").Prisma.InputJsonValue },
      update: { value: merged as unknown as import("@prisma/client").Prisma.InputJsonValue }
    });

    return NextResponse.json({ success: true, config: merged });
  } catch (error: unknown) {
    console.error('Error in POST /api/settings/mcp:', error);
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 });
  }
}
