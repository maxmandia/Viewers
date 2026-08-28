import { id } from './id';
import type { Deps } from './deps';
import { ShortIds } from './ids';
import { ToolHost } from './lifecycle';

const VIEWPORTS_READY = 'event::viewportsReady';
const ids = new ShortIds();
let host: ToolHost | null = null;
let readySub: { unsubscribe: () => void } | null = null;

function makeDeps(
  servicesManager: Deps['servicesManager'],
  commandsManager: Deps['commandsManager'],
  extensionManager: Deps['extensionManager']
): Deps {
  return { ids, servicesManager, commandsManager, extensionManager };
}

export default {
  id,
  preRegistration({
    servicesManager,
    commandsManager,
    extensionManager,
  }: {
    servicesManager: Deps['servicesManager'];
    commandsManager: Deps['commandsManager'];
    extensionManager: Deps['extensionManager'];
  }) {
    host = new ToolHost(makeDeps(servicesManager, commandsManager, extensionManager));
    void host.setRoute('worklist');
  },
  onModeEnter({
    servicesManager,
  }: {
    servicesManager: Deps['servicesManager'];
  }) {
    const { viewportGridService } = servicesManager.services;
    readySub?.unsubscribe();
    host?.stop();
    const tryViewer = () => {
      const state = viewportGridService?.getState();
      const ready = [...(state?.viewports?.values() ?? [])].some(viewport => viewport.isReady);
      if (ready) {
        void host?.setRoute('viewer');
      }
    };
    tryViewer();
    readySub = viewportGridService?.subscribe(VIEWPORTS_READY, () => {
      void host?.setRoute('viewer');
    });
  },
  onModeExit() {
    readySub?.unsubscribe();
    readySub = null;
    void host?.setRoute('worklist');
  },
};
