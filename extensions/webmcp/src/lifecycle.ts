import type { Deps } from './deps';
import { getModelContext } from './modelContext';
import { toolsForRoute, type RouteId } from './tools';

export class ToolHost {
  private abort: AbortController | null = null;
  private route: RouteId | null = null;

  constructor(private readonly deps: Deps) {}

  async setRoute(route: RouteId): Promise<void> {
    if (this.route === route && this.abort) {
      return;
    }
    this.abort?.abort();
    const abort = new AbortController();
    this.abort = abort;
    this.route = route;
    if (!getModelContext() || !document.modelContext) {
      return;
    }
    for (const tool of toolsForRoute(route, this.deps)) {
      if (abort.signal.aborted) {
        return;
      }
      await document.modelContext.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          execute: tool.execute,
        },
        { signal: abort.signal }
      );
    }
  }

  stop(): void {
    this.abort?.abort();
    this.abort = null;
    this.route = null;
  }
}
