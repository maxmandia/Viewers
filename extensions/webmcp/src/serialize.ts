import {
  OUTPUT_BUDGET,
  type MeasurementSummary,
  type SeriesSummary,
  type StudyHit,
  type ViewerSnapshot,
} from './types';
import type { ShortIds } from './ids';

const PHI_KEYS = new Set([
  'patientName',
  'PatientName',
  'mrn',
  'PatientID',
  'patientBirthDate',
  'PatientBirthDate',
  'accession',
  'AccessionNumber',
]);

export function toolOutput(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length <= OUTPUT_BUDGET) {
    return text;
  }
  return `${text.slice(0, OUTPUT_BUDGET - 3)}...`;
}

export function sanitizeStudy(
  raw: Record<string, unknown>,
  ids: ShortIds
): StudyHit {
  const full = String(raw.studyInstanceUid || raw.StudyInstanceUID || '');
  return {
    id: ids.intern('s', full),
    date: String(raw.date || raw.StudyDate || ''),
    modality: String(raw.modalities || raw.ModalitiesInStudy || ''),
    description: String(raw.description || raw.StudyDescription || '').slice(0, 80),
  };
}

export function assertNoPhi(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (PHI_KEYS.has(key)) {
      throw new Error(`PHI field leaked: ${key}`);
    }
  }
}

export function sanitizeSeries(
  raw: {
    displaySetInstanceUID?: string;
    Modality?: string;
    SeriesDescription?: string;
    label?: string;
    numImageFrames?: number;
    numImages?: number;
    isReconstructable?: boolean;
  },
  ids: ShortIds
): SeriesSummary {
  const full = String(raw.displaySetInstanceUID || '');
  return {
    id: ids.intern('ds', full),
    modality: String(raw.Modality || ''),
    description: String(raw.SeriesDescription || raw.label || '').slice(0, 80),
    imageCount: Number(raw.numImageFrames ?? raw.numImages ?? 0),
    reconstructable: Boolean(raw.isReconstructable),
  };
}

function displayTextOf(measurement: { displayText?: unknown; text?: unknown }): string {
  const { displayText } = measurement;
  if (Array.isArray(displayText)) {
    return displayText.map(String).join(' ').slice(0, 80);
  }
  if (displayText && typeof displayText === 'object' && 'primary' in displayText) {
    const primary = (displayText as { primary?: unknown }).primary;
    return String(Array.isArray(primary) ? primary.join(' ') : primary || '').slice(0, 80);
  }
  return String(displayText || measurement.text || '').slice(0, 80);
}

export function sanitizeMeasurement(
  raw: {
    uid?: string;
    type?: string;
    toolName?: string;
    label?: string;
    displayText?: unknown;
  },
  ids: ShortIds
): MeasurementSummary {
  const full = String(raw.uid || '');
  return {
    uid: ids.intern('m', full),
    type: String(raw.toolName || raw.type || ''),
    text: displayTextOf(raw),
    label: String(raw.label || '').slice(0, 80),
  };
}

export function voiFromLut(lut: {
  properties?: Record<string, unknown> | { voiRange?: { lower: number; upper: number } };
}): { window: number | null; level: number | null } {
  const props = lut?.properties;
  if (!props) {
    return { window: null, level: null };
  }
  const first =
    'voiRange' in props || 'voi' in props || 'windowWidth' in props
      ? props
      : (Object.values(props)[0] as Record<string, unknown> | undefined);
  if (!first || typeof first !== 'object') {
    return { window: null, level: null };
  }
  const voiRange = (first as { voiRange?: { lower: number; upper: number } }).voiRange;
  if (voiRange && voiRange.upper != null && voiRange.lower != null) {
    return {
      window: voiRange.upper - voiRange.lower,
      level: (voiRange.upper + voiRange.lower) / 2,
    };
  }
  const windowWidth = (first as { windowWidth?: number }).windowWidth;
  const windowCenter = (first as { windowCenter?: number }).windowCenter;
  if (windowWidth != null && windowCenter != null) {
    return { window: Number(windowWidth), level: Number(windowCenter) };
  }
  return { window: null, level: null };
}

export function buildViewerSnapshot(input: {
  protocolId?: string;
  numRows?: number;
  numCols?: number;
  viewportId?: string;
  slice?: number | null;
  sliceCount?: number | null;
  window?: number | null;
  level?: number | null;
  seriesLabel?: string;
  measurementCount: number;
  activeTool?: string;
}): ViewerSnapshot {
  const rows = input.numRows ?? 1;
  const cols = input.numCols ?? 1;
  return {
    protocol: String(input.protocolId || 'default'),
    layout: `${rows}x${cols}`,
    viewportId: String(input.viewportId || ''),
    slice: input.slice ?? null,
    sliceCount: input.sliceCount ?? null,
    window: input.window ?? null,
    level: input.level ?? null,
    seriesLabel: String(input.seriesLabel || '').slice(0, 80),
    measurementCount: input.measurementCount,
    activeTool: String(input.activeTool || ''),
  };
}
