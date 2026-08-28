import { ShortIds } from './ids';
import { parseToolInput } from './modelContext';
import { toolsForRoute } from './tools';
import type { Deps } from './deps';

function mockDeps(overrides: Partial<Deps> = {}): Deps {
  return {
    ids: new ShortIds(),
    commandsManager: {
      runCommand: jest.fn(),
    },
    servicesManager: {
      services: {},
    },
    extensionManager: {
      getActiveDataSource: () => [],
    },
    ...overrides,
  };
}

describe('parseToolInput', () => {
  it('parses a JSON string', () => {
    expect(parseToolInput('{"studyId":"s1"}')).toEqual({ studyId: 's1' });
  });

  it('returns an object input as-is', () => {
    expect(parseToolInput({ layout: 'mpr' })).toEqual({ layout: 'mpr' });
  });
});

describe('toolsForRoute', () => {
  it('exposes worklist tools only on the worklist', () => {
    const names = toolsForRoute('worklist', mockDeps()).map(tool => tool.name);
    expect(names).toEqual(['search_studies', 'open_study']);
  });

  it('omits worklist tools in the viewer', () => {
    const names = toolsForRoute('viewer', mockDeps()).map(tool => tool.name);
    expect(names).not.toContain('search_studies');
    expect(names).toContain('get_viewer_state');
    expect(names).toContain('save_dicom_sr');
  });
});

describe('search_studies', () => {
  it('strips patient fields from QIDO hits', async () => {
    const deps = mockDeps({
      extensionManager: {
        getActiveDataSource: () => [
          {
            query: {
              studies: {
                search: async () => [
                  {
                    studyInstanceUid: '1.2.3',
                    date: '20200101',
                    modalities: 'CT',
                    description: 'CHEST',
                    patientName: 'DOE^JOHN',
                    mrn: '999',
                  },
                ],
              },
            },
          },
        ],
      },
    });
    const [search] = toolsForRoute('worklist', deps);
    const text = await search.execute({ query: 'chest' });
    const parsed = JSON.parse(text);
    expect(parsed.studies).toEqual([
      { id: 's1', date: '20200101', modality: 'CT', description: 'CHEST' },
    ]);
    expect(text).not.toContain('DOE');
    expect(text).not.toContain('999');
  });
});

describe('open_study', () => {
  it('navigates with the interned StudyInstanceUID', async () => {
    const runCommand = jest.fn();
    const deps = mockDeps({
      commandsManager: { runCommand },
    });
    deps.ids.intern('s', '1.2.3');
    const open = toolsForRoute('worklist', deps).find(tool => tool.name === 'open_study');
    await open?.execute({ studyId: 's1' });
    expect(runCommand).toHaveBeenCalledWith(
      'navigateHistory',
      { to: 'viewer?StudyInstanceUIDs=1.2.3' },
      'DEFAULT'
    );
  });
});

describe('set_active_tool', () => {
  it('runs setToolActiveToolbar in the CORNERSTONE context', async () => {
    const runCommand = jest.fn();
    const deps = mockDeps({
      commandsManager: { runCommand },
    });
    const tool = toolsForRoute('viewer', deps).find(item => item.name === 'set_active_tool');
    await tool?.execute({ toolName: 'Length' });
    expect(runCommand).toHaveBeenCalledWith(
      'setToolActiveToolbar',
      { toolName: 'Length' },
      'CORNERSTONE'
    );
  });
});

describe('set_layout', () => {
  it('applies mpr with reset so a cached grid is not restored', async () => {
    const runCommand = jest.fn().mockReturnValue(true);
    const deps = mockDeps({
      commandsManager: { runCommand },
    });
    const tool = toolsForRoute('viewer', deps).find(item => item.name === 'set_layout');
    await tool?.execute({ layout: 'mpr' });
    expect(runCommand).toHaveBeenCalledWith(
      'setHangingProtocol',
      { protocolId: 'mpr', reset: true },
      'DEFAULT'
    );
  });
});
