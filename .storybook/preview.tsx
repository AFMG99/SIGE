import type { Preview } from '@storybook/nextjs-vite'
import { type ViewportMap } from 'storybook/viewport'

import '../src/app/globals.css'
import { HeaderPosProvider, SubNavProvider } from '../src/shared/views/nav/NavContext'
import { ToastProvider } from '../src/shared/views/ui/ToastProvider'

/**
 * Matriz SIGE — un viewport por breakpoint real de Tailwind, para poder
 * verificar en la toolbar de Storybook que cada historia se adapta en los
 * tamaños que la app soporta:
 *   · 320 → borde inferior (por debajo de `sm`)
 *   · 375 → móvil, por debajo de `md` (territorio de menú hamburguesa)
 *   · 768 → justo en `md`
 *   · 1024 → justo en `lg` (umbral del chrome de escritorio)
 *   · 1280 → `xl`
 *   · 1920 → escritorio ancho
 */
export const SIGE_VIEWPORTS: ViewportMap = {
  borde320: {
    name: 'Borde 320 · bajo sm',
    styles: { width: '320px', height: '568px' },
    type: 'mobile',
  },
  movil375: {
    name: 'Móvil 375 · bajo md',
    styles: { width: '375px', height: '812px' },
    type: 'mobile',
  },
  tablet768: {
    name: 'Tablet 768 · md',
    styles: { width: '768px', height: '1024px' },
    type: 'tablet',
  },
  laptop1024: {
    name: 'Laptop 1024 · lg',
    styles: { width: '1024px', height: '768px' },
    type: 'desktop',
  },
  desktop1280: {
    name: 'Escritorio 1280 · xl',
    styles: { width: '1280px', height: '800px' },
    type: 'desktop',
  },
  ancho1920: {
    name: 'Ancho 1920',
    styles: { width: '1920px', height: '1080px' },
    type: 'desktop',
  },
}

const preview: Preview = {
  decorators: [
    (Story) => (
      <HeaderPosProvider value="center">
        <SubNavProvider>
          <ToastProvider>
            <Story />
          </ToastProvider>
        </SubNavProvider>
      </HeaderPosProvider>
    ),
  ],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    // Toolbar "Viewport" con la matriz SIGE (no el dispositivo genérico).
    // Por defecto sigue en "Responsive" (llena el área de la historia).
    viewport: {
      options: SIGE_VIEWPORTS,
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    }
  },
};

export default preview;