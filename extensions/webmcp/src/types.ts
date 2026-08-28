export type StudyHit = {
  id: string;
  date: string;
  modality: string;
  description: string;
};

export type ViewerSnapshot = {
  protocol: string;
  layout: string;
  viewportId: string;
  slice: number | null;
  sliceCount: number | null;
  window: number | null;
  level: number | null;
  seriesLabel: string;
  measurementCount: number;
  activeTool: string;
};

export type SeriesSummary = {
  id: string;
  modality: string;
  description: string;
  imageCount: number;
  reconstructable: boolean;
};

export type MeasurementSummary = {
  uid: string;
  type: string;
  text: string;
  label: string;
};

export const OUTPUT_BUDGET = 1500;

export const CT_PRESETS = {
  'soft-tissue': { window: 400, level: 40 },
  lung: { window: 1500, level: -600 },
  liver: { window: 150, level: 90 },
  bone: { window: 2500, level: 480 },
  brain: { window: 80, level: 40 },
} as const;

export type CtPreset = keyof typeof CT_PRESETS;

export type LayoutId = 'mpr' | '1x1' | '1x2' | '2x2';

export type StackAction = 'next' | 'prev' | 'first' | 'last';

export type ActiveToolName =
  | 'WindowLevel'
  | 'Zoom'
  | 'Pan'
  | 'StackScroll'
  | 'Length'
  | 'Bidirectional'
  | 'Probe';
