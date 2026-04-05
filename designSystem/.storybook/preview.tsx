import type { Preview } from '@storybook/react-vite';
import '../src/styles.css';
import {
  applyColorTheme,
  applyDensityAndScaleTokens,
  COLOR_THEME_PRESETS,
  type ColorThemeKey,
  DENSITY_PRESETS,
  DESIGN_TOKEN_DEFAULTS,
  type DensityKey,
  FONT_SCALE_PRESETS,
  type FontScaleKey,
  RADIUS_PRESETS,
  type RadiusKey,
  SHADOW_PRESETS,
  type ShadowKey,
} from '../src/lib/design-tokens';

function ensureKey<T extends string>(
  value: unknown,
  options: Readonly<Record<T, unknown>>,
  fallback: T
): T {
  if (typeof value === 'string' && value in options) {
    return value as T;
  }
  return fallback;
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
  },
  globalTypes: {
    colorTheme: {
      name: 'Theme',
      defaultValue: DESIGN_TOKEN_DEFAULTS.colorTheme,
      toolbar: {
        dynamicTitle: true,
        icon: 'mirror',
        items: Object.entries(COLOR_THEME_PRESETS).map(([value, meta]) => ({
          value,
          title: meta.label,
        })),
      },
    },
    fontScale: {
      name: 'Font',
      defaultValue: DESIGN_TOKEN_DEFAULTS.fontScale,
      toolbar: {
        dynamicTitle: true,
        icon: 'paragraph',
        items: Object.entries(FONT_SCALE_PRESETS).map(([value, meta]) => ({
          value,
          title: meta.label,
        })),
      },
    },
    density: {
      name: 'Density',
      defaultValue: DESIGN_TOKEN_DEFAULTS.density,
      toolbar: {
        dynamicTitle: true,
        icon: 'component',
        items: Object.entries(DENSITY_PRESETS).map(([value, meta]) => ({
          value,
          title: meta.label,
        })),
      },
    },
    radius: {
      name: 'Radius',
      defaultValue: DESIGN_TOKEN_DEFAULTS.radius,
      toolbar: {
        dynamicTitle: true,
        icon: 'circlehollow',
        items: Object.entries(RADIUS_PRESETS).map(([value, meta]) => ({
          value,
          title: meta.label,
        })),
      },
    },
    shadow: {
      name: 'Shadow',
      defaultValue: DESIGN_TOKEN_DEFAULTS.shadow,
      toolbar: {
        dynamicTitle: true,
        icon: 'circle',
        items: Object.entries(SHADOW_PRESETS).map(([value, meta]) => ({
          value,
          title: meta.label,
        })),
      },
    },
  },
  decorators: [
    (Story, context) => {
      const colorTheme = ensureKey<ColorThemeKey>(
        context.globals.colorTheme,
        COLOR_THEME_PRESETS,
        DESIGN_TOKEN_DEFAULTS.colorTheme
      );
      const fontScale = ensureKey<FontScaleKey>(
        context.globals.fontScale,
        FONT_SCALE_PRESETS,
        DESIGN_TOKEN_DEFAULTS.fontScale
      );
      const density = ensureKey<DensityKey>(
        context.globals.density,
        DENSITY_PRESETS,
        DESIGN_TOKEN_DEFAULTS.density
      );
      const radius = ensureKey<RadiusKey>(
        context.globals.radius,
        RADIUS_PRESETS,
        DESIGN_TOKEN_DEFAULTS.radius
      );
      const shadow = ensureKey<ShadowKey>(
        context.globals.shadow,
        SHADOW_PRESETS,
        DESIGN_TOKEN_DEFAULTS.shadow
      );

      applyColorTheme(colorTheme);
      applyDensityAndScaleTokens({
        fontScale,
        density,
        radius,
        shadow,
      });

      const isFullscreen = context.parameters.layout === 'fullscreen';

      return (
        <div
          className={`theme min-h-screen w-full bg-background text-foreground ${
            isFullscreen ? '' : 'p-6'
          }`}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
