export class AgentRegistry {
  private static instance: AgentRegistry;
  private controllers: Map<string, AbortController> = new Map();
  private isListening = false;

  private constructor() {}

  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  // startGlobalListener removed as we now poll DB state in AgentFactory directly for Cloud Run compatibility.

  public register(agentInstanceId: string, controller: AbortController): void {
    this.controllers.set(agentInstanceId, controller);
  }

  public abort(agentInstanceId: string): void {
    const controller = this.controllers.get(agentInstanceId);
    if (controller) {
      controller.abort();
      this.controllers.delete(agentInstanceId);
    }
  }

  public unregister(agentInstanceId: string): void {
    this.controllers.delete(agentInstanceId);
  }

  public unregisterIfMatches(agentInstanceId: string, controller: AbortController): void {
    if (this.controllers.get(agentInstanceId) === controller) {
      this.controllers.delete(agentInstanceId);
    }
  }

  public has(agentInstanceId: string): boolean {
    return this.controllers.has(agentInstanceId);
  }
}

export const agentRegistry = AgentRegistry.getInstance();
