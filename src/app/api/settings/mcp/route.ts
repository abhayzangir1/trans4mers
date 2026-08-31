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
    
    const redactedConfig = { ...config };
    if (redactedConfig.apiKeys) {
      redactedConfig.apiKeys = { ...redactedConfig.apiKeys };
      for (const [key, value] of Object.entries(redactedConfig.apiKeys)) {
        if (value && value.length > 4) {
          redactedConfig.apiKeys[key] = `sk-...${value.slice(-4)}`;
        } else if (value) {
          redactedConfig.apiKeys[key] = '***';
        }
      }
    }

    return NextResponse.json(redactedConfig);
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
    
    // Validate payload shape
    const { z } = await import('zod');
    const settingsSchema = z.object({
      mcpServers: z.record(z.unknown()).optional(),
      plugins: z.record(z.unknown()).optional(),
      overseer: z.record(z.unknown()).optional(),
      theme: z.record(z.unknown()).optional(),
      apiKeys: z.record(z.string()).optional()
    });

    const parsed = settingsSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload schema', details: parsed.error }, { status: 400 });
    }
    const validPayload = parsed.data;

    const config = await getConfig();
    
    // Deep merge payload into config
    const merged: McpConfig = { ...config };
    
    if (validPayload.mcpServers) merged.mcpServers = { ...merged.mcpServers, ...validPayload.mcpServers };
    if (validPayload.plugins) merged.plugins = { ...merged.plugins, ...validPayload.plugins };
    if (validPayload.overseer) merged.overseer = { ...merged.overseer, ...validPayload.overseer };
    if (validPayload.theme) merged.theme = { ...merged.theme, ...validPayload.theme };
    if (validPayload.apiKeys) {
      const filteredKeys = { ...validPayload.apiKeys };
      // Prevent data corruption: don't overwrite real DB keys with redacted UI placeholders
      for (const [key, value] of Object.entries(filteredKeys)) {
        if (typeof value === 'string' && (value.startsWith('sk-...') || value === '***')) {
          delete filteredKeys[key];
        }
      }
      merged.apiKeys = { ...merged.apiKeys, ...filteredKeys };
    }
    
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
