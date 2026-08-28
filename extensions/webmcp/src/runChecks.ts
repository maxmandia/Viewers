import assert from 'node:assert/strict';
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

const ids = new ShortIds();
const first = ids.intern('s', '1.2.3');
assert.equal(ids.intern('s', '1.2.3'), first);
assert.equal(ids.resolve(first), '1.2.3');
assert.equal(ids.resolve('1.2.840.113619.2.1'), '1.2.840.113619.2.1');

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
assert.deepEqual(hit, {
  id: 's1',
  date: '20200101',
  modality: 'CT',
  description: 'CHEST',
});
assertNoPhi(hit as unknown as Record<string, unknown>);

assert.deepEqual(
  sanitizeSeries(
    {
      displaySetInstanceUID: 'ds-guid',
      Modality: 'CT',
      SeriesDescription: 'AXIAL',
      numImageFrames: 120,
      isReconstructable: true,
    },
    ids
  ),
  {
    id: 'ds1',
    modality: 'CT',
    description: 'AXIAL',
    imageCount: 120,
    reconstructable: true,
  }
);

assert.deepEqual(
  sanitizeMeasurement(
    {
      uid: 'ann-1',
      toolName: 'Length',
      label: 'nodule',
      displayText: { primary: ['12.4 mm'] },
    },
    ids
  ),
  {
    uid: 'm1',
    type: 'Length',
    text: '12.4 mm',
    label: 'nodule',
  }
);

assert.deepEqual(voiFromLut({ properties: { voiRange: { lower: -200, upper: 200 } } }), {
  window: 400,
  level: 0,
});

assert.equal(
  buildViewerSnapshot({
    protocolId: 'mpr',
    numRows: 1,
    numCols: 3,
    viewportId: 'default-0',
    measurementCount: 2,
    activeTool: 'Length',
  }).layout,
  '1x3'
);

const text = toolOutput('x'.repeat(OUTPUT_BUDGET + 50));
assert.equal(text.length, OUTPUT_BUDGET);
assert.equal(text.endsWith('...'), true);

console.log('webmcp serialize checks passed');
