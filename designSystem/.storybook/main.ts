import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(baseConfig) {
    return {
      ...baseConfig,
      resolve: {
        ...baseConfig.resolve,
        alias: {
          ...baseConfig.resolve?.alias,
          '@': path.resolve(dirname, '../src'),
        },
      },
    };
  },
};

export default config;
