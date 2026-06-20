import type { Meta, StoryObj } from '@storybook/react-vite';
import { StarRating } from './StarRating.js';

const meta: Meta<typeof StarRating> = {
  title: 'Primitives/StarRating',
  component: StarRating,
  args: { value: 4.3, showValue: true, count: 42 },
  argTypes: { value: { control: { type: 'range', min: 0, max: 5, step: 0.1 } } },
};
export default meta;

type Story = StoryObj<typeof StarRating>;

export const Default: Story = {};
export const Full: Story = { args: { value: 5, count: 8 } };
export const Empty: Story = { args: { value: 0, count: 0 } };
export const StarsOnly: Story = { args: { showValue: false } };
