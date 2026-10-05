import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ModuleNav } from './ModuleNav'

const meta = {
  component: ModuleNav,
  tags: ['ai-generated'],
  // ModuleNav always renders inside the chrome surface (DashboardHeader),
  // so the story must show it on the same background to be readable.
  decorators: [
    (Story) => (
      <div className="chrome-forest w-full max-w-3xl rounded-lg p-3">
        <Story />
      </div>
    ),
  ],
  args: {
    role: 'ADMIN_TI',
    variant: 'bar',
  },
} satisfies Meta<typeof ModuleNav>

export default meta
type Story = StoryObj<typeof meta>

export const VarianteBar: Story = {
  name: 'Barra superior de módulos',
}

export const VarianteSidebar: Story = {
  name: 'Riel lateral con árbol de datos',
  args: { variant: 'sidebar' },
}

export const VarianteRail: Story = {
  name: 'Rail compacto',
  args: { variant: 'rail' },
}
