import { useEffect, useSyncExternalStore } from 'react';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { check } from '@tauri-apps/plugin-updater';
import { createUpdateController } from './update_controller';
import packageInfo from '../../package.json';

export const appVersion = packageInfo.version;
const controller = createUpdateController({
  enabled: isTauri() && !import.meta.env.DEV && getCurrentWindow().label === 'main',
  currentVersion: appVersion,
  check,
  beforeInstall: async () => { await invoke('prepare_for_update'); },
  installFailed: async () => { await invoke('resume_after_update_error'); },
  relaunch: async () => { await invoke('restart_after_update'); },
});
export const { checkForUpdates, installUpdate, restartAfterUpdate, dismissUpdateNotice } = controller;
export function useAppUpdater() {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  useEffect(controller.start, []);
  return state;
}
