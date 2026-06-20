import type { Meta, StoryObj } from '@storybook/react-vite';
import { Skeleton } from './Skeleton.js';

const meta: Meta<typeof Skeleton> = {
  title: 'Primitives/Skeleton',
  component: Skeleton,
};
export default meta;

type Story = StoryObj<typeof Skeleton>;

export const Line: Story = { args: { width: '12rem', height: '1rem' } };

export const TutorCard: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.75rem', inlineSize: '20rem' }}>
      <Skeleton width="4.5rem" height="4.5rem" rounded />
      <div style={{ flex: 1, display: 'grid', gap: '0.5rem' }}>
        <Skeleton width="60%" height="1.1rem" />
        <Skeleton width="40%" height="0.9rem" />
        <Skeleton width="100%" height="3rem" />
      </div>
    </div>
  ),
};
