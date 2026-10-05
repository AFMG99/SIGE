import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/nextjs-vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Las server actions del módulo importan `@/lib/prisma`, que no puede entrar
 * en el bundle del navegador. En Storybook se sustituyen por dobles que
 * devuelven resultados deterministas para poder documentar el flujo completo
 * (carga → mapeo → vista → resultado) sin backend.
 */
const SERVER_ACTIONS_MOCK = path.resolve(
  dirname,
  '../src/app/dashboard/datos/__mocks__/serverActions.ts'
);

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
  framework: '@storybook/nextjs-vite',
  staticDirs: ['..\\public'],
  viteFinal(viteConfig) {
    const actual = viteConfig.resolve?.alias;
    const base = Array.isArray(actual)
      ? actual
      : Object.entries(actual ?? {}).map(([find, replacement]) => ({ find, replacement }));

    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = [
      { find: '@/actions/facturas', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/actions/equipos', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/actions/variables', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/actions/edificaciones', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/actions/lineasBase', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/actions/ajustes', replacement: SERVER_ACTIONS_MOCK },
      { find: '@', replacement: path.resolve(dirname, '../src') },
      ...base,
    ];
    return viteConfig;
  },
};

export default config;
