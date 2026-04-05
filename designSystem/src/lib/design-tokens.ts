export const FONT_SCALE_PRESETS = {
  small: { label: 'Small', value: '0.875rem' },
  default: { label: 'Default', value: '1rem' },
  large: { label: 'Large', value: '1.125rem' },
} as const;

export const DENSITY_PRESETS = {
  compact: { label: 'Compact', value: '0.75' },
  default: { label: 'Default', value: '1' },
  comfortable: { label: 'Comfortable', value: '1.25' },
} as const;

export const RADIUS_PRESETS = {
  sharp: { label: 'Sharp', value: '0' },
  default: { label: 'Default', value: '1' },
  rounded: { label: 'Rounded', value: '2' },
  pill: { label: 'Pill', value: '9999' },
} as const;

export const SHADOW_PRESETS = {
  none: { label: 'None', var: 'none' },
  subtle: {
    label: 'Subtle',
    var: '0 1px 3px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.10)',
  },
  medium: {
    label: 'Medium',
    var: '0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)',
  },
  strong: {
    label: 'Strong',
    var: '0 20px 25px -5px rgb(0 0 0 / 0.15), 0 8px 10px -6px rgb(0 0 0 / 0.10)',
  },
} as const;

export const COLOR_THEME_PRESETS = {
  light: { label: 'Light', className: 'theme-light' },
  dark: { label: 'Dark', className: 'theme-dark' },
  'tokyo-night': { label: 'Tokyo Night', className: 'theme-tokyo-night' },
} as const;

export type FontScaleKey = keyof typeof FONT_SCALE_PRESETS;
export type DensityKey = keyof typeof DENSITY_PRESETS;
export type RadiusKey = keyof typeof RADIUS_PRESETS;
export type ShadowKey = keyof typeof SHADOW_PRESETS;
export type ColorThemeKey = keyof typeof COLOR_THEME_PRESETS;

export const DESIGN_TOKEN_DEFAULTS = {
  colorTheme: 'light',
  fontScale: 'default',
  density: 'default',
  radius: 'default',
  shadow: 'subtle',
} as const satisfies {
  colorTheme: ColorThemeKey;
  fontScale: FontScaleKey;
  density: DensityKey;
  radius: RadiusKey;
  shadow: ShadowKey;
};

function getRootElement(root?: HTMLElement | null) {
  if (root) {
    return root;
  }
  if (typeof document !== 'undefined') {
    return document.documentElement;
  }
  return null;
}

export function applyDensityAndScaleTokens(
  options: {
    fontScale: FontScaleKey;
    density: DensityKey;
    radius: RadiusKey;
    shadow: ShadowKey;
  },
  root?: HTMLElement | null
) {
  const rootElement = getRootElement(root);
  if (!rootElement) {
    return;
  }
  rootElement.style.setProperty('--font-size-base', FONT_SCALE_PRESETS[options.fontScale].value);
  rootElement.style.setProperty('--spacing-unit', DENSITY_PRESETS[options.density].value);
  rootElement.style.setProperty('--radius-factor', RADIUS_PRESETS[options.radius].value);
  rootElement.style.setProperty('--shadow-md', SHADOW_PRESETS[options.shadow].var);
}

export function applyColorTheme(theme: ColorThemeKey, root?: HTMLElement | null) {
  const rootElement = getRootElement(root);
  if (!rootElement) {
    return;
  }
  for (const className of rootElement.classList) {
    if (className.startsWith('theme-')) {
      rootElement.classList.remove(className);
    }
  }
  rootElement.classList.add(COLOR_THEME_PRESETS[theme].className);
}
