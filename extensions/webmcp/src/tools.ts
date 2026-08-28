import type { Deps } from './deps';
import { parseToolInput, type RegisteredTool } from './modelContext';
import {
  buildViewerSnapshot,
  sanitizeMeasurement,
  sanitizeSeries,
  sanitizeStudy,
  toolOutput,
  voiFromLut,
} from './serialize';
import { CT_PRESETS, type ActiveToolName, type CtPreset, type LayoutId, type StackAction } from './types';

export type RouteId = 'worklist' | 'viewer';

type ToolSpec = Omit<RegisteredTool, 'execute'> & {
  routes: RouteId[];
  run: (input: Record<string, unknown>, deps: Deps) => Promise<unknown>;
};

const LAYOUTS: Record<LayoutId, { protocolId?: string; numRows?: number; numCols?: number }> = {
  mpr: { protocolId: 'mpr' },
  '1x1': { numRows: 1, numCols: 1 },
  '1x2': { numRows: 1, numCols: 2 },
  '2x2': { numRows: 2, numCols: 2 },
};

const TOOLS: Record<ActiveToolName, true> = {
  WindowLevel: true,
  Zoom: true,
  Pan: true,
  StackScroll: true,
  Length: true,
  Bidirectional: true,
  Probe: true,
};

function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && value in LAYOUTS;
}

function isPreset(value: unknown): value is CtPreset {
  return typeof value === 'string' && value in CT_PRESETS;
}

function isStackAction(value: unknown): value is StackAction {
  return value === 'next' || value === 'prev' || value === 'first' || value === 'last';
}

function isActiveTool(value: unknown): value is ActiveToolName {
  return typeof value === 'string' && value in TOOLS;
}

function requireId(deps: Deps, raw: unknown, label: string): string {
  const key = String(raw || '');
  const full = deps.ids.resolve(key);
  if (!full) {
    throw new Error(`${label} is unknown. Call the matching list tool first.`);
  }
  return full;
}

async function searchStudies(input: Record<string, unknown>, deps: Deps) {
  const [dataSource] = deps.extensionManager.getActiveDataSource() || [];
  const search = dataSource?.query?.studies?.search;
  if (!search) {
    throw new Error('No DICOMweb study search is available.');
  }
  const rows = await search({});
  const query = String(input.query || '').trim().toLowerCase();
  const hits = rows
    .map(row => sanitizeStudy(row, deps.ids))
    .filter(hit => {
      if (!query) {
        return true;
      }
      return `${hit.description} ${hit.modality} ${hit.date}`.toLowerCase().includes(query);
    })
    .slice(0, 8);
  return { studies: hits };
}

async function openStudy(input: Record<string, unknown>, deps: Deps) {
  const studyUid = requireId(deps, input.studyId, 'studyId');
  deps.commandsManager.runCommand(
    'navigateHistory',
    { to: `viewer?StudyInstanceUIDs=${encodeURIComponent(studyUid)}` },
    'DEFAULT'
  );
  return { opened: true, studyId: String(input.studyId) };
}

function readViewerSnapshot(deps: Deps) {
  const { viewportGridService, hangingProtocolService, measurementService, cornerstoneViewportService, toolGroupService, displaySetService } =
    deps.servicesManager.services;
  const grid = viewportGridService?.getState();
  const viewportId = viewportGridService?.getActiveViewportId() || '';
  const presentations = viewportId ? cornerstoneViewportService?.getPresentations(viewportId) : undefined;
  const voi = voiFromLut(presentations?.lutPresentation || {});
  const csViewport = viewportId ? cornerstoneViewportService?.getCornerstoneViewport?.(viewportId) : undefined;
  const displaySets = viewportId ? cornerstoneViewportService?.getViewportDisplaySets(viewportId) : [];
  const series = displaySets?.[0] ? sanitizeSeries(displaySets[0], deps.ids) : undefined;
  const slice =
    presentations?.positionPresentation?.initialImageIndex ??
    presentations?.positionPresentation?.viewReference?.sliceIndex ??
    null;
  return buildViewerSnapshot({
    protocolId: hangingProtocolService?.getState()?.protocolId,
    numRows: grid?.layout?.numRows,
    numCols: grid?.layout?.numCols,
    viewportId,
    slice,
    sliceCount: csViewport?.getImageIds?.().length ?? displaySetService?.getActiveDisplaySets?.().length ?? null,
    window: voi.window,
    level: voi.level,
    seriesLabel: series?.description,
    measurementCount: measurementService?.getMeasurements()?.length ?? 0,
    activeTool: toolGroupService?.getActivePrimaryMouseButtonTool() || '',
  });
}

function listSeries(deps: Deps) {
  const sets = deps.servicesManager.services.displaySetService?.getActiveDisplaySets() || [];
  return {
    series: sets.map(set => sanitizeSeries(set, deps.ids)),
  };
}

function listMeasurements(deps: Deps) {
  const { measurementService, panelService } = deps.servicesManager.services;
  panelService?.activatePanel(
    '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
    true
  );
  const rows = measurementService?.getMeasurements() || [];
  return {
    measurements: rows.map(row => sanitizeMeasurement(row, deps.ids)),
  };
}

async function setLayout(input: Record<string, unknown>, deps: Deps) {
  if (!isLayoutId(input.layout)) {
    throw new Error('layout must be mpr, 1x1, 1x2, or 2x2.');
  }
  const layout = LAYOUTS[input.layout];
  if (layout.protocolId) {
    const ok = deps.commandsManager.runCommand(
      'setHangingProtocol',
      { protocolId: layout.protocolId, reset: true },
      'DEFAULT'
    );
    if (ok === false) {
      throw new Error('Hanging protocol mpr does not match the loaded series.');
    }
  } else {
    deps.commandsManager.runCommand(
      'setViewportGridLayout',
      { numRows: layout.numRows, numCols: layout.numCols },
      'DEFAULT'
    );
  }
  return readViewerSnapshot(deps);
}

async function setWindowLevel(input: Record<string, unknown>, deps: Deps) {
  const viewportId = deps.servicesManager.services.viewportGridService?.getActiveViewportId();
  if (!viewportId) {
    throw new Error('No active viewport.');
  }
  let windowWidth: number;
  let windowCenter: number;
  if (isPreset(input.preset)) {
    ({ window: windowWidth, level: windowCenter } = CT_PRESETS[input.preset]);
  } else if (input.window != null && input.level != null) {
    windowWidth = Number(input.window);
    windowCenter = Number(input.level);
    if (!Number.isFinite(windowWidth) || !Number.isFinite(windowCenter)) {
      throw new Error('window and level must be numbers.');
    }
  } else {
    throw new Error('Provide preset or window and level.');
  }
  deps.commandsManager.runCommand(
    'setViewportWindowLevel',
    { viewportId, windowWidth, windowCenter },
    'CORNERSTONE'
  );
  return readViewerSnapshot(deps);
}

async function navigateStack(input: Record<string, unknown>, deps: Deps) {
  if (input.imageIndex != null) {
    deps.commandsManager.runCommand(
      'jumpToImage',
      { imageIndex: Number(input.imageIndex) },
      'CORNERSTONE'
    );
    return readViewerSnapshot(deps);
  }
  if (!isStackAction(input.action)) {
    throw new Error('action must be next, prev, first, or last.');
  }
  const names: Record<StackAction, string> = {
    next: 'nextImage',
    prev: 'previousImage',
    first: 'firstImage',
    last: 'lastImage',
  };
  deps.commandsManager.runCommand(names[input.action], {}, 'CORNERSTONE');
  return readViewerSnapshot(deps);
}

async function setActiveTool(input: Record<string, unknown>, deps: Deps) {
  if (!isActiveTool(input.toolName)) {
    throw new Error('Unknown toolName.');
  }
  deps.commandsManager.runCommand(
    'setToolActiveToolbar',
    { toolName: input.toolName },
    'CORNERSTONE'
  );
  return { activeTool: input.toolName };
}

async function assignSeries(input: Record<string, unknown>, deps: Deps) {
  const displaySetInstanceUID = requireId(deps, input.seriesId, 'seriesId');
  const viewportId =
    String(input.viewportId || '') ||
    deps.servicesManager.services.viewportGridService?.getActiveViewportId() ||
    '';
  if (!viewportId) {
    throw new Error('No viewport to assign.');
  }
  deps.commandsManager.runCommand(
    'setDisplaySetsForViewports',
    {
      viewportsToUpdate: [{ viewportId, displaySetInstanceUIDs: [displaySetInstanceUID] }],
    },
    'CORNERSTONE'
  );
  return readViewerSnapshot(deps);
}

async function jumpToMeasurement(input: Record<string, unknown>, deps: Deps) {
  const uid = requireId(deps, input.uid, 'uid');
  const measurement = deps.servicesManager.services.measurementService?.getMeasurement(uid);
  if (!measurement) {
    throw new Error('Measurement is not on the current study.');
  }
  deps.commandsManager.runCommand(
    'jumpToMeasurementViewport',
    { annotationUID: uid, measurement },
    'CORNERSTONE'
  );
  listMeasurements(deps);
  return { jumped: true, uid: String(input.uid) };
}

async function labelMeasurement(input: Record<string, unknown>, deps: Deps) {
  const uid = requireId(deps, input.uid, 'uid');
  const label = String(input.label || '').trim();
  if (!label) {
    throw new Error('label is required.');
  }
  deps.commandsManager.runCommand(
    'updateMeasurement',
    { uid, textLabel: label },
    'CORNERSTONE'
  );
  listMeasurements(deps);
  return sanitizeMeasurement(
    { ...deps.servicesManager.services.measurementService?.getMeasurement(uid), uid, label },
    deps.ids
  );
}

async function exportMeasurements(deps: Deps) {
  deps.commandsManager.runCommand('downloadCSVMeasurementsReport', {}, 'CORNERSTONE');
  return { downloaded: 'measurements.csv' };
}

async function saveDicomSr(input: Record<string, unknown>, deps: Deps) {
  const measurements = deps.servicesManager.services.measurementService?.getMeasurements() || [];
  if (!measurements.length) {
    throw new Error('No measurements to save. Have the human draw Length or Bidirectional first.');
  }
  if (typeof window !== 'undefined' && !window.confirm('Download a DICOM SR of the current measurements?')) {
    return { cancelled: true };
  }
  await deps.commandsManager.runCommand(
    'storeMeasurements',
    {
      measurementData: measurements,
      dataSource: 'download',
      additionalFindingTypes: ['ArrowAnnotate'],
      options: { SeriesDescription: String(input.title || 'WebMCP Report') },
    },
    'CORNERSTONE_STRUCTURED_REPORT'
  );
  return { downloaded: 'dicom-sr.dcm' };
}

const specs: ToolSpec[] = [
  {
    name: 'search_studies',
    description: 'Search the worklist and return compact study hits. Use before open_study. Omits patient name and MRN.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional filter on description, modality, or date.' },
      },
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    routes: ['worklist'],
    run: searchStudies,
  },
  {
    name: 'open_study',
    description: 'Open a study in Basic Viewer. studyId comes from search_studies.',
    inputSchema: {
      type: 'object',
      properties: {
        studyId: { type: 'string', description: 'Short id from search_studies, or a StudyInstanceUID.' },
      },
      required: ['studyId'],
    },
    annotations: { readOnlyHint: false },
    routes: ['worklist'],
    run: openStudy,
  },
  {
    name: 'get_viewer_state',
    description: 'Return layout, hanging protocol, slice, window/level, and measurement count for the active viewport.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    routes: ['viewer'],
    run: async (_input, deps) => readViewerSnapshot(deps),
  },
  {
    name: 'list_series',
    description: 'List hung series (display sets) with short ids for assign_series.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    routes: ['viewer'],
    run: async (_input, deps) => listSeries(deps),
  },
  {
    name: 'set_layout',
    description: 'Hang MPR or a grid layout on the live viewports.',
    inputSchema: {
      type: 'object',
      properties: {
        layout: { type: 'string', enum: ['mpr', '1x1', '1x2', '2x2'] },
      },
      required: ['layout'],
    },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: setLayout,
  },
  {
    name: 'set_window_level',
    description: 'Apply a CT preset or explicit window and level to the active viewport.',
    inputSchema: {
      type: 'object',
      properties: {
        preset: { type: 'string', enum: ['soft-tissue', 'lung', 'liver', 'bone', 'brain'] },
        window: { type: 'number' },
        level: { type: 'number' },
      },
    },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: setWindowLevel,
  },
  {
    name: 'navigate_stack',
    description: 'Move to another slice. Prefer action, or pass imageIndex (0-based).',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['next', 'prev', 'first', 'last'] },
        imageIndex: { type: 'number' },
      },
    },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: navigateStack,
  },
  {
    name: 'set_active_tool',
    description: 'Activate a mouse tool. Use Length or Bidirectional then ask the human to click the lesion.',
    inputSchema: {
      type: 'object',
      properties: {
        toolName: {
          type: 'string',
          enum: ['WindowLevel', 'Zoom', 'Pan', 'StackScroll', 'Length', 'Bidirectional', 'Probe'],
        },
      },
      required: ['toolName'],
    },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: setActiveTool,
  },
  {
    name: 'assign_series',
    description: 'Put a series from list_series into a viewport. Defaults to the active viewport.',
    inputSchema: {
      type: 'object',
      properties: {
        seriesId: { type: 'string' },
        viewportId: { type: 'string' },
      },
      required: ['seriesId'],
    },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: assignSeries,
  },
  {
    name: 'list_measurements',
    description: 'List measurements on the current study. Opens the measurements panel.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    routes: ['viewer'],
    run: async (_input, deps) => listMeasurements(deps),
  },
  {
    name: 'jump_to_measurement',
    description: 'Jump the viewport to a measurement uid from list_measurements.',
    inputSchema: {
      type: 'object',
      properties: { uid: { type: 'string' } },
      required: ['uid'],
    },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: jumpToMeasurement,
  },
  {
    name: 'label_measurement',
    description: 'Set the visible label on a measurement without opening a dialog.',
    inputSchema: {
      type: 'object',
      properties: {
        uid: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['uid', 'label'],
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    routes: ['viewer'],
    run: labelMeasurement,
  },
  {
    name: 'export_measurements',
    description: 'Download a CSV of current measurements.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: async (_input, deps) => exportMeasurements(deps),
  },
  {
    name: 'save_dicom_sr',
    description: 'Download a DICOM SR of current measurements after the human confirms the browser dialog.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Series description for the SR.' },
      },
    },
    annotations: { readOnlyHint: false },
    routes: ['viewer'],
    run: saveDicomSr,
  },
];

export function toolsForRoute(route: RouteId, deps: Deps): RegisteredTool[] {
  return specs
    .filter(spec => spec.routes.includes(route))
    .map(spec => ({
      name: spec.name,
      description: spec.description,
      inputSchema: spec.inputSchema,
      annotations: spec.annotations,
      execute: async rawInput => {
        try {
          const input = parseToolInput(rawInput);
          const result = await spec.run(input, deps);
          return toolOutput(result);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return toolOutput({ error: message });
        }
      },
    }));
}
