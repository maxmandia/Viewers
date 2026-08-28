export type ToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type RegisteredTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<string>;
};

export function getModelContext(): NonNullable<Document['modelContext']> | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const ctx = document.modelContext;
  if (!ctx || typeof ctx.registerTool !== 'function') {
    return null;
  }
  return ctx;
}

export function parseToolInput(input: unknown): Record<string, unknown> {
  if (input == null) {
    return {};
  }
  if (typeof input === 'string') {
    if (!input) {
      return {};
    }
    const parsed: unknown = JSON.parse(input);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  }
  if (typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}
