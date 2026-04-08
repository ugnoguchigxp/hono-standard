import { useEffect, useState } from 'react';

export type ThemeMode = 'theme-light' | 'theme-dark' | 'theme-tokyo-night';

export interface DesignSettings {
  theme: ThemeMode;
  density: number;
  radius: number;
  fontSize: number;
}

const DEFAULT_SETTINGS: DesignSettings = {
  theme: 'theme-light',
  density: 1.0,
  radius: 1.0,
  fontSize: 1.0,
};

const STORAGE_KEY = 'wellpathy-design-settings';

export function useDesignSystem() {
  const [settings, setSettings] = useState<DesignSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse design settings', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Theme (Class)
    const themes = ['theme-light', 'theme-dark', 'theme-tokyo-night'];
    for (const t of themes) {
      if (t === settings.theme) {
        root.classList.add(t);
      } else {
        root.classList.remove(t);
      }
    }
    // Handle .dark for Radix/Tailwind standard dark mode support if needed
    if (settings.theme === 'theme-dark' || settings.theme === 'theme-tokyo-night') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // CSS Variables (Inline Styles)
    root.style.setProperty('--spacing-unit', settings.density.toString());
    root.style.setProperty('--radius-factor', settings.radius.toString());
    root.style.setProperty('--font-size-base', `${settings.fontSize}rem`);

    // Persist
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<DesignSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
