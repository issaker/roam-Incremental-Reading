import React from 'react';
import settingsPanelConfig from '~/settingsPanelConfig';

export type Settings = {
  tagsListString: string;
  dataPageTitle: string;
  dailyLimit: number;
  rtlEnabled: boolean;
  shuffleCards: boolean;
  defaultPriority: number;
  fsrsEnabled: boolean;
};

export const defaultSettings: Settings = {
  tagsListString: 'memo',
  dataPageTitle: 'roam/memo',
  dailyLimit: 0, // 0 = no limit,
  rtlEnabled: false,
  shuffleCards: false,
  defaultPriority: 70,
  fsrsEnabled: true, // ✅ 默认启用FSRS算法 - 更科学的记忆预测
};

// @TODO: Refactor/Hoist this so we can call useSettings in multiple places
// without duplicating settings state (ie maybe init state in app and use
// context to access it anywhere)
const useSettings = () => {
  const [settings, setSettings] = React.useState(defaultSettings);

  // If tagsListString is empty, set it to the default
  React.useEffect(() => {
    if (!settings.tagsListString.trim()) {
      setSettings((currentSettings) => ({
        ...currentSettings,
        tagsListString: defaultSettings.tagsListString,
      }));
    }
  }, [settings]);

  // Create settings panel
  React.useEffect(() => {
    window.roamMemo.extensionAPI.settings.panel.create(
      settingsPanelConfig({ settings, setSettings })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSettings, settings.dataPageTitle]);

  React.useEffect(() => {
    const allSettings = window.roamMemo.extensionAPI.settings.getAll() || {};
    
    // Manually set shuffleCards to true if it doesn't exist. Reason: Can't
    // figure out how to make the switch UI default to on so let's just set it
    // to true here unless toggled off
    if (!('shuffleCards' in allSettings)) {
      window.roamMemo.extensionAPI.settings.set('shuffleCards', defaultSettings.shuffleCards);
    }
    
    // 迁移旧的schedulingAlgorithm设置到新的fsrsEnabled布尔值
    if ('schedulingAlgorithm' in allSettings && !('fsrsEnabled' in allSettings)) {
      const fsrsEnabled = allSettings.schedulingAlgorithm === 'FSRS';
      window.roamMemo.extensionAPI.settings.set('fsrsEnabled', fsrsEnabled);
      // 可以选择删除旧设置：
      // window.roamMemo.extensionAPI.settings.remove('schedulingAlgorithm');
    }
    
    // 确保fsrsEnabled有默认值
    if (!('fsrsEnabled' in allSettings)) {
      window.roamMemo.extensionAPI.settings.set('fsrsEnabled', defaultSettings.fsrsEnabled);
    }

    // For some reason the getAll() method casts numbers to strings, so here we
    // map keys in this list back to numbers
    const numbers = ['dailyLimit', 'defaultPriority'];

    const filteredSettings = Object.keys(allSettings).reduce((acc, key) => {
      const value = allSettings[key];
      acc[key] = numbers.includes(key) ? Number(value) : value;
      return acc;
    }, {});

    setSettings((currentSettings) => ({ ...currentSettings, ...filteredSettings }));
  }, [setSettings]);

  return settings;
};

export default useSettings;
