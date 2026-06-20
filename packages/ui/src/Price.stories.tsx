import type { Meta, StoryObj } from '@storybook/react-vite';
import { Price } from './Price.js';

const meta: Meta<typeof Price> = {
  title: 'Primitives/Price',
  component: Price,
  args: { cents: 3500, currency: 'USD', locale: 'en', unit: '/hr' },
};
export default meta;

type Story = StoryObj<typeof Price>;

export const Default: Story = {};
export const Euro: Story = { args: { currency: 'EUR', locale: 'en' } };
export const Arabic: Story = { args: { currency: 'AED', locale: 'ar' } };
