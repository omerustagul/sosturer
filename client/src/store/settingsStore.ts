import { create } from 'zustand';
import { api } from '../lib/api';
import i18n from '../i18n';

export interface AppSettings {
  language: string;
  timezone: string;
  dataRetentionMonths: number;
  autoBackup: string;
  theme: string;
  tableDensity: string;
  animationsEnabled: boolean;
  notificationsEnabled: boolean;
  twoFactorEnabled: boolean;
  ipRestrictionEnabled: boolean;
  sapIntegrationEnabled: boolean;
  webhooksEnabled: boolean;
  allowSupportAccess: boolean;
  colorMode: 'light' | 'dark';
  dashboardLayout: string;
  referenceLocationId?: string;
  standardShiftIds?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  productionEventWarehouseRequired?: boolean;
}

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  isInitialized: boolean;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  applyTheme: (theme: string) => void;
  applyDensity: (density: string) => void;
  applyAnimations: (enabled: boolean) => void;
  applyColorMode: (mode: 'light' | 'dark') => void;
  applyLanguage: (lang: string) => void;
}

const getLocalStorage = (key: string, defaultValue: any) => {
  try {
    const val = localStorage.getItem(`sosturer_${key}`);
    if (val === null) return defaultValue;
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  } catch (e) { return defaultValue; }
};

const setLocalStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(`sosturer_${key}`, String(value));
  } catch (e) {}
};

const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const defaultMode = systemPrefersDark ? 'dark' : 'light';

const defaultSettings: AppSettings = {
  language: 'tr',
  timezone: 'Europe/Istanbul',
  dataRetentionMonths: 24,
  autoBackup: 'daily',
  theme: getLocalStorage('theme', defaultMode),
  tableDensity: getLocalStorage('density', 'large'),
  animationsEnabled: getLocalStorage('animations', true),
  notificationsEnabled: true,
  twoFactorEnabled: false,
  ipRestrictionEnabled: false,
  sapIntegrationEnabled: false,
  webhooksEnabled: false,
  allowSupportAccess: false,
  colorMode: getLocalStorage('color_mode', defaultMode) as 'light' | 'dark',
  dashboardLayout: '[]',
  referenceLocationId: '',
  standardShiftIds: '[]',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  productionEventWarehouseRequired: false,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,
  isInitialized: false,
  fetchSettings: async () => {
    set({ loading: true });
    try {
      const data = await api.get('/app-settings');
      if (data) {
        set({ settings: data, isInitialized: true });
        get().applyTheme(data.theme);
        get().applyDensity(data.tableDensity);
        get().applyAnimations(data.animationsEnabled);
        get().applyColorMode(data.colorMode || 'dark');
        get().applyLanguage(data.language);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      set({ loading: false });
    }
  },
  updateSettings: async (newSettings) => {
    try {
      const updated = await api.post('/app-settings', newSettings);
      set({ settings: updated });
      if (newSettings.theme) get().applyTheme(updated.theme);
      if (newSettings.tableDensity) get().applyDensity(updated.tableDensity);
      if (newSettings.animationsEnabled !== undefined) get().applyAnimations(updated.animationsEnabled);
      if (newSettings.colorMode) get().applyColorMode(updated.colorMode);
      if (newSettings.language) get().applyLanguage(updated.language);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  },
  applyTheme: (() => {
    let transitionTimer: number | null = null;
    return (theme: string) => {
      const root = document.documentElement;
      root.classList.add('theme-transition');
      root.setAttribute('data-theme', theme);
      setLocalStorage('theme', theme);

      if (transitionTimer) window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(() => {
        root.classList.remove('theme-transition');
      }, 260);
    };
  })(),
  applyDensity: (density) => {
    document.documentElement.setAttribute('data-density', density);
    setLocalStorage('density', density);
  },
  applyAnimations: (enabled) => {
    document.documentElement.setAttribute('data-animations', String(enabled));
    setLocalStorage('animations', String(enabled));
  },
  applyColorMode: (mode) => {
    document.documentElement.setAttribute('data-color-mode', mode);
    setLocalStorage('color_mode', mode);
  },
  applyLanguage: (lang) => {
    i18n.changeLanguage(lang);
    setLocalStorage('language', lang);
  }
}));
