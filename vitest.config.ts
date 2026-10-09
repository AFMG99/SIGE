import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
      {
        // Pruebas de layout responsivo: renderizan componentes reales en un
        // navegador y cambian el tamaño del viewport con `page.viewport()` para
        // detectar desbordamientos horizontales en cada breakpoint.
        // Ficheros: `src/**/*.responsive.test.tsx`
        extends: true,
        resolve: {
          alias: { '@': path.resolve(dirname, 'src') },
        },
        // react/react-dom deben salir del mismo bundle del optimizador; si uno
        // se sirve desde node_modules y el otro prebundled hay dos copias de
        // React y los hooks fallan con "Cannot read properties of null".
        // `@prisma/client`/`bcryptjs`/`jose`/`next/headers` sólo se alcanzan
        // por el análisis estático de los server controllers (en runtime se
        // mockean): fijarlos aquí evita que Vite recargue el test a mitad de
        // la ejecución ("Vite unexpectedly reloaded a test").
        optimizeDeps: {
          include: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            'react-dom/client',
            '@prisma/client',
            'bcryptjs',
            'jose',
            'next/headers',
          ],
        },
        // tsconfig usa `jsx: "preserve"` (requerido por Next), así que Vite
        // necesita que esbuild transforme el JSX aquí explícitamente.
        esbuild: { jsx: 'automatic' },
        test: {
          name: 'responsive',
          include: ['src/**/*.responsive.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
