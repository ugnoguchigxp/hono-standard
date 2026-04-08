import type * as React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode =
  | 'light'
  | 'dark'
  | 'tokyonight'
  | 'eclipse'
  | 'macosclassic'
  | 'fire'
  | 'classicterminal'
  | 'sakurabloom'
  | 'leafmint'
  | 'lattecream'
  | 'sunshineOrange';

export interface DesignSettings {
  theme: ThemeMode;
  density: number;
  radius: number;
  fontSize: number;
}

const DEFAULT_SETTINGS: DesignSettings = {
  theme: 'light',
  density: 1.0,
  radius: 1.0,
  fontSize: 1.0,
};

const STORAGE_KEY = 'wellpathy-design-settings';

interface DesignSystemContextType {
  settings: DesignSettings;
  updateSettings: (updates: Partial<DesignSettings>) => void;
  resetSettings: () => void;
}

const DesignSystemContext = createContext<DesignSystemContextType | undefined>(undefined);

export function DesignSystemProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<DesignSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      const loaded = saved ? JSON.parse(saved) : {};
      const merged = { ...DEFAULT_SETTINGS, ...loaded };
      setSettings(merged);
    } catch (e) {
      console.error('Failed to parse design settings', e);
      setSettings(DEFAULT_SETTINGS);
    }
    setIsHydrated(true);
  }, []);

  // Apply settings to document
  useEffect(() => {
    if (!isHydrated) return;

    const root = document.documentElement;

    // Theme (data-theme attribute)
    if (settings.theme === 'light') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', settings.theme);
    }

    // Handle .dark for Tailwind standard dark mode support
    const darkThemes = ['dark', 'tokyonight', 'fire', 'classicterminal'];
    if (darkThemes.includes(settings.theme)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // UI Density (data-density attribute for gxp-designSystem)
    const densityValue = settings.density;
    if (densityValue <= 0.85) {
      root.setAttribute('data-density', 'compact');
    } else if (densityValue >= 1.15) {
      root.setAttribute('data-density', 'spacious');
    } else {
      root.setAttribute('data-density', 'normal');
    }

    // Border Radius (--radius CSS variable)
    const radiusValue = settings.radius;
    root.style.setProperty('--radius', `${radiusValue * 0.5}rem`);

    // Font Size (--ui-font-size-base CSS variable)
    root.style.setProperty('--ui-font-size-base', `${settings.fontSize}rem`);

    // Persist
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, isHydrated]);

  const updateSettings = (updates: Partial<DesignSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <DesignSystemContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </DesignSystemContext.Provider>
  );
}

export function useDesignSystem() {
  const context = useContext(DesignSystemContext);
  if (context === undefined) {
    throw new Error('useDesignSystem must be used within a DesignSystemProvider');
  }
  return context;
}
