import React from 'react';
import settingsPanelConfig from '~/settingsPanelConfig';

export type Settings = {
  dataPageTitle: string;
  dailyLimit: number;
  rtlEnabled: boolean;
  shuffleCards: boolean;
  defaultPriority: number;
  fsrsEnabled: boolean;
  isGlobalMixedMode: boolean;
};

export const defaultSettings: Settings = {
  dataPageTitle: 'roam/memo',
  dailyLimit: 0, // 0 = no limit,
  rtlEnabled: false,
  shuffleCards: false,
  defaultPriority: 70,
  fsrsEnabled: true, // ✅ 默认启用FSRS算法 - 更科学的记忆预测
  isGlobalMixedMode: false, // 默认关闭全局混合模式
};

// @TODO: Refactor/Hoist this so we can call useSettings in multiple places
// without duplicating settings state (ie maybe init state in app and use
// context to access it anywhere)
const useSettings = (): [Settings, React.Dispatch<React.SetStateAction<Settings>>] => {
  const [settings, setSettings] = React.useState(defaultSettings);

  // Create settings panel
  React.useEffect(() => {
    window.roamMemo.extensionAPI.settings.panel.create(
      settingsPanelConfig({ settings, setSettings })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSettings, settings.dataPageTitle]);

  React.useEffect(() => {
    const allSettings = window.roamMemo.extensionAPI.settings.getAll() || {};

    // 1. 迁移和设置默认值
    // Manually set shuffleCards to true if it doesn't exist.
    if (!('shuffleCards' in allSettings)) {
      allSettings.shuffleCards = defaultSettings.shuffleCards;
    }
    // 迁移旧的schedulingAlgorithm设置到新的fsrsEnabled布尔值
    if ('schedulingAlgorithm' in allSettings && !('fsrsEnabled' in allSettings)) {
      allSettings.fsrsEnabled = allSettings.schedulingAlgorithm === 'FSRS';
      // window.roamMemo.extensionAPI.settings.remove('schedulingAlgorithm');
    }
    // 确保fsrsEnabled有默认值
    if (!('fsrsEnabled' in allSettings)) {
      allSettings.fsrsEnabled = defaultSettings.fsrsEnabled;
    }
    
    // 2. 合并 fetched settings 和 default settings，确保没有 null/undefined
    const mergedSettings = { ...defaultSettings, ...allSettings };

    // 3. 类型转换
    // For some reason the getAll() method casts numbers to strings, so here we
    // map keys in this list back to numbers
    const numbers = ['dailyLimit', 'defaultPriority'];
    numbers.forEach(key => {
        if (typeof mergedSettings[key] === 'string') {
            mergedSettings[key] = Number(mergedSettings[key]);
        }
    });

    // 4. 使用净化后的数据一次性更新 state
    setSettings(mergedSettings);

    // 将净化后的默认值写回 Roam settings
    Object.keys(defaultSettings).forEach(key => {
        if (!(key in allSettings)) {
            window.roamMemo.extensionAPI.settings.set(key, defaultSettings[key]);
        }
    });
  }, [setSettings]);

  return [settings, setSettings];
};

export default useSettings;
