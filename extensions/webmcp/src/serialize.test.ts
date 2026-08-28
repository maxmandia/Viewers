import { ShortIds } from './ids';
import {
  assertNoPhi,
  buildViewerSnapshot,
  sanitizeMeasurement,
  sanitizeSeries,
  sanitizeStudy,
  toolOutput,
  voiFromLut,
} from './serialize';
import { OUTPUT_BUDGET } from './types';

describe('ShortIds', () => {
  it('returns the same short id for the same UID', () => {
    const ids = new ShortIds();
    const first = ids.intern('s', '1.2.3');
    expect(ids.intern('s', '1.2.3')).toBe(first);
    expect(ids.resolve(first)).toBe('1.2.3');
  });

  it('accepts a full dotted UID without intern', () => {
    const ids = new ShortIds();
    expect(ids.resolve('1.2.840.113619.2.1')).toBe('1.2.840.113619.2.1');
  });
});

describe('sanitizeStudy', () => {
  it('drops patient identifiers', () => {
    const ids = new ShortIds();
    const hit = sanitizeStudy(
      {
        studyInstanceUid: '1.2.3',
        date: '20200101',
        modalities: 'CT',
        description: 'CHEST',
        patientName: 'DOE^JOHN',
        mrn: '999',
        accession: 'A1',
        patientBirthDate: '19700101',
      },
      ids
    );
    expect(hit).toEqual({
      id: 's1',
      date: '20200101',
      modality: 'CT',
      description: 'CHEST',
    });
    assertNoPhi(hit as unknown as Record<string, unknown>);
  });
});

describe('sanitizeSeries', () => {
  it('maps display set fields and interned id', () => {
    const ids = new ShortIds();
    expect(
      sanitizeSeries(
        {
          displaySetInstanceUID: 'ds-guid',
          Modality: 'CT',
          SeriesDescription: 'AXIAL',
          numImageFrames: 120,
          isReconstructable: true,
        },
        ids
      )
    ).toEqual({
      id: 'ds1',
      modality: 'CT',
      description: 'AXIAL',
      imageCount: 120,
      reconstructable: true,
    });
  });
});

describe('sanitizeMeasurement', () => {
  it('uses interned uid and primary display text', () => {
    const ids = new ShortIds();
    expect(
      sanitizeMeasurement(
        {
          uid: 'ann-1',
          toolName: 'Length',
          label: 'nodule',
          displayText: { primary: ['12.4 mm'] },
        },
        ids
      )
    ).toEqual({
      uid: 'm1',
      type: 'Length',
      text: '12.4 mm',
      label: 'nodule',
    });
  });
});

describe('voiFromLut', () => {
  it('derives window and level from voiRange', () => {
    expect(voiFromLut({ properties: { voiRange: { lower: -200, upper: 200 } } })).toEqual({
      window: 400,
      level: 0,
    });
  });
});

describe('buildViewerSnapshot', () => {
  it('formats layout as rows x cols', () => {
    expect(
      buildViewerSnapshot({
        protocolId: 'mpr',
        numRows: 1,
        numCols: 3,
        viewportId: 'default-0',
        measurementCount: 2,
        activeTool: 'Length',
      }).layout
    ).toBe('1x3');
  });
});

describe('toolOutput', () => {
  it('truncates past the character budget', () => {
    const text = toolOutput('x'.repeat(OUTPUT_BUDGET + 50));
    expect(text.length).toBe(OUTPUT_BUDGET);
    expect(text.endsWith('...')).toBe(true);
  });
});
