import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tag } from './Tag.js';

const meta: Meta<typeof Tag> = {
  title: 'Primitives/Tag',
  component: Tag,
  args: { children: 'Algebra' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['neutral', 'beginner', 'intermediate', 'advanced'] },
  },
};
export default meta;

type Story = StoryObj<typeof Tag>;

export const Levels: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Tag tone="beginner">Beginner</Tag>
      <Tag tone="intermediate">Intermediate</Tag>
      <Tag tone="advanced">Advanced</Tag>
      <Tag>Subject</Tag>
    </div>
  ),
};
