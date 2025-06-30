import * as asyncUtils from '~/utils/async';
import RoamSrImportPanel from '~/components/RoamSrImportPanel';
import { defaultSettings } from './hooks/useSettings';

const settingsPanelConfig = ({ settings, setSettings }) => {
  const syncFn = async ({ key, value }: { key: string; value: any }) => {
    window.roamMemo.extensionAPI.settings.set(key, value);
    setSettings((currentSettings) => {
      return { ...currentSettings, [key]: value };
    });
  };

  const processChange = asyncUtils.debounce((e) => syncFn(e));

  return {
    tabTitle: 'Memo Enhanced',
    settings: [
      {
        id: 'fsrsEnabled',
        name: 'Enable FSRS Algorithm/启用FSRS算法',
        description: 'Enable the modern FSRS algorithm instead of SM2. FSRS provides better long-term retention prediction. \n默认启用更先进的FSRS算法，提供基于机器学习的记忆预测。若想切换回经典的SM2算法，可关闭此开关。',
        action: {
          type: 'switch',
          checked: settings.fsrsEnabled,
          onChange: (e) => {
            processChange({ key: 'fsrsEnabled', value: e.target.checked });
          },
        },
      },
      {
        id: 'migrate-roam-sr-data',
        name: 'Migrate Roam/Sr Data',
        description: 'A tool to import your Roam/Sr data into Memo Enhanced.',
        action: {
          type: 'reactComponent',
          component: () => <RoamSrImportPanel dataPageTitle={settings.dataPageTitle} />,
        },
      },
      {
        id: 'dataPageTitle',
        name: 'Data Page Title',
        description: "Name of page where we'll store all your data",
        action: {
          type: 'input',
          placeholder: defaultSettings.dataPageTitle,
          onChange: (e) => {
            const value = e.target.value.trim();
            processChange({ key: 'dataPageTitle', value });
          },
        },
      },
      {
        id: 'dailyLimit',
        name: 'Daily Review Limit',
        description: 'Number of cards to review each day. 0 means no limit.',
        action: {
          type: 'input',
          placeholder: defaultSettings.dailyLimit,
          onChange: (e) => {
            const value = e.target.value.trim();
            const isNumber = !isNaN(Number(value));

            processChange({ key: 'dailyLimit', value: isNumber ? Number(value) : 0 });
          },
        },
      },
      {
        id: 'rtlEnabled',
        name: 'Right-to-Left (RTL) Enabled',
        description: 'Enable RTL for languages like Arabic, Hebrew, etc.',
        action: {
          type: 'switch',
          checked: settings.rtlEnabled,
          onChange: (e) => {
            processChange({ key: 'rtlEnabled', value: e.target.checked });
          },
        },
      },
      {
        id: 'shuffleCards',
        name: 'Shuffle Cards',
        description: 'Randomly shuffle the order of new and due cards during review.',
        action: {
          type: 'switch',
          checked: settings.shuffleCards,
          onChange: (e) => {
            processChange({ key: 'shuffleCards', value: e.target.checked });
          },
        },
      },
      {
        id: 'defaultPriority',
        name: 'Default Priority for New Cards',
        description: 'Set the default priority (0-100) for new cards. Higher numbers = higher priority. New cards will be added to the ranking list with this priority.',
        action: {
          type: 'input',
          placeholder: defaultSettings.defaultPriority.toString(),
          onChange: (e) => {
            const value = e.target.value.trim();
            const numValue = Number(value);
            
            // 验证输入范围 0-100
            if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
              processChange({ key: 'defaultPriority', value: numValue });
            } else if (value === '') {
              // 允许空输入，使用默认值
              processChange({ key: 'defaultPriority', value: defaultSettings.defaultPriority });
            }
          },
        },
      },
    ],
  };
};

export default settingsPanelConfig;
