import { ViewSettings } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getStyles } from '@/utils/style';
import { eventDispatcher } from '@/utils/event';

export const saveViewSettings = async <K extends keyof ViewSettings>(
  envConfig: EnvConfigType,
  bookKey: string,
  key: K,
  value: ViewSettings[K],
  skipGlobal = false,
  applyStyles = true,
) => {
  const { settings, isFontLayoutSettingsGlobal, setSettings, saveSettings } =
    useSettingsStore.getState();
  const { getView, getViewSettings, setViewSettings } = useReaderStore.getState();
  const { getConfig, saveConfig } = useBookDataStore.getState();
  const viewSettings = getViewSettings(bookKey)!;
  const config = getConfig(bookKey)!;
  if (viewSettings[key] !== value) {
    viewSettings[key] = value;
    if (applyStyles) {
      const view = getView(bookKey);
      view?.renderer.setStyles?.(getStyles(viewSettings));
    }
  }
  setViewSettings(bookKey, viewSettings);

  // 派发注释设置变更事件，仅对当前页面生效
  if (key.includes('wordAnnotation') || key.includes('phraseAnnotation')) {
    eventDispatcher.dispatch('annotation-settings-changed', { bookKey, key, value });
  }

  if (isFontLayoutSettingsGlobal && !skipGlobal) {
    settings.globalViewSettings[key] = value;
    setSettings(settings);
  }
  await saveConfig(envConfig, bookKey, config, settings);
  await saveSettings(envConfig, settings);
};
