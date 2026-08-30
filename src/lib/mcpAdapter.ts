import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export type MCPAdapterConfig = 
  | { type: 'stdio'; command: string; args: string[]; env?: Record<string, string> }
  | { type: 'sse'; url: string };

export class DynamicMCPAdapter {
  private client: Client;
  private transport: StdioClientTransport | SSEClientTransport | null = null;

  constructor(private config: MCPAdapterConfig) {
    this.client = new Client(
      {
        name: 'trans4mers-agent',
        version: '1.0.0',
      },
      {
        capabilities: {
          // Client capabilities don't define tools/resources
        },
      }
    );
  }

  async connect(): Promise<void> {
    if (this.config.type === 'stdio') {
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
      });
    } else if (this.config.type === 'sse') {
      this.transport = new SSEClientTransport(new URL(this.config.url));
    }

    if (this.transport) {
      await this.client.connect(this.transport);
    }
  }

  async getTools(): Promise<unknown> {
    return await this.client.listTools();
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return await this.client.callTool({
      name,
      arguments: args,
    });
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
  }
}
