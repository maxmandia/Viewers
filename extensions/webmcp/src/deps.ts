import type { ShortIds } from './ids';

export type Deps = {
  ids: ShortIds;
  commandsManager: {
    runCommand: (name: string, options?: Record<string, unknown>, context?: string) => unknown;
  };
  servicesManager: {
    services: {
      displaySetService?: {
        getActiveDisplaySets: () => Array<Record<string, unknown>>;
      };
      viewportGridService?: {
        getState: () => {
          layout?: { numRows?: number; numCols?: number };
          viewports?: Map<string, { isReady?: boolean; displaySetInstanceUIDs?: string[] }>;
        };
        getActiveViewportId: () => string | null;
        subscribe: (event: string, cb: () => void) => { unsubscribe: () => void };
      };
      hangingProtocolService?: {
        getState: () => { protocolId?: string } | undefined;
      };
      measurementService?: {
        getMeasurements: () => Array<Record<string, unknown> & { uid?: string }>;
        getMeasurement: (uid: string) => Record<string, unknown> | undefined;
      };
      cornerstoneViewportService?: {
        getPresentations: (viewportId: string) => {
          positionPresentation?: {
            initialImageIndex?: number;
            viewReference?: { sliceIndex?: number };
          };
          lutPresentation?: {
            properties?: Record<string, unknown>;
          };
        };
        getViewportDisplaySets: (viewportId: string) => Array<Record<string, unknown>>;
        getCornerstoneViewport?: (viewportId: string) => {
          getImageIds?: () => string[];
        };
      };
      toolGroupService?: {
        getActivePrimaryMouseButtonTool: () => string | undefined;
      };
      panelService?: {
        activatePanel: (panelId: string, forceActive?: boolean) => void;
      };
    };
  };
  extensionManager: {
    getActiveDataSource: () => Array<{
      query?: {
        studies?: {
          search: (params: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
        };
      };
    }>;
  };
};
