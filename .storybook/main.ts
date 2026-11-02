import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from '@storybook/nextjs-vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Las server actions del módulo importan `@/shared/models/prisma`, que no puede entrar
 * en el bundle del navegador. En Storybook se sustituyen por dobles que
 * devuelven resultados deterministas para poder documentar el flujo completo
 * (carga → mapeo → vista → resultado) sin backend.
 */
const SERVER_ACTIONS_MOCK = path.resolve(
  dirname,
  '../src/features/datos/views/__mocks__/serverActions.ts'
);

const ANALISIS_MOCK = path.resolve(
  dirname,
  '../src/features/analisis/views/__mocks__/serverActions.ts'
);

const ALERTAS_MOCK = path.resolve(
  dirname,
  '../src/features/alertas/views/__mocks__/serverActions.ts'
);

const ESTIMACIONES_MOCK = path.resolve(
  dirname,
  '../src/features/estimaciones/views/__mocks__/serverActions.ts'
);

const ESPACIAL_MOCK = path.resolve(
  dirname,
  '../src/features/espacial/views/__mocks__/serverActions.ts'
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
  staticDirs: ['../public'],
  viteFinal(viteConfig) {
    const actual = viteConfig.resolve?.alias;
    const base = Array.isArray(actual)
      ? actual
      : Object.entries(actual ?? {}).map(([find, replacement]) => ({ find, replacement }));

    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = [
      { find: '@/features/datos/controllers/facturas', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/datos/controllers/equipos', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/datos/controllers/variables', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/datos/controllers/edificaciones', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/datos/controllers/calendario', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/datos/controllers/horarios', replacement: SERVER_ACTIONS_MOCK },
      // T7 (eventos del calendario): mismo doble que el resto de datos — el
      // controller real importa Prisma y no puede entrar al bundle del navegador.
      { find: '@/features/datos/controllers/eventos', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/datos/controllers/lineasBase', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/datos/controllers/ajustes', replacement: SERVER_ACTIONS_MOCK },
      // Cálculo de uso (T5): el controller importa Prisma; doble determinista.
      { find: '@/features/datos/controllers/calculoUso', replacement: SERVER_ACTIONS_MOCK },
      { find: '@/features/analisis/controllers/analisis', replacement: ANALISIS_MOCK },
      { find: '@/features/analisis/controllers/xm', replacement: ANALISIS_MOCK },
      { find: '@/features/alertas/controllers/alertas', replacement: ALERTAS_MOCK },
      { find: '@/features/estimaciones/controllers/forecast', replacement: ESTIMACIONES_MOCK },
      { find: '@/features/espacial/controllers/confirmarImportacionCad', replacement: ESPACIAL_MOCK },
      { find: '@', replacement: path.resolve(dirname, '../src') },
      ...base,
    ];
    return viteConfig;
  },
};

export default config;
