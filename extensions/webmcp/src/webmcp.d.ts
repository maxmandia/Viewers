export {};

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
          execute: (
            input: unknown,
            options?: { signal?: AbortSignal }
          ) => Promise<string> | string;
        },
        options?: { signal?: AbortSignal }
      ): Promise<void>;
    };
  }
}
