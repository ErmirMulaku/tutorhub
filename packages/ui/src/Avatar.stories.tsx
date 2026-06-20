import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from './Avatar.js';

const meta: Meta<typeof Avatar> = {
  title: 'Primitives/Avatar',
  component: Avatar,
  args: { name: 'Amara Okafor' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] } },
};
export default meta;

type Story = StoryObj<typeof Avatar>;

export const Initials: Story = {};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <Avatar {...args} size="sm" />
      <Avatar {...args} size="md" />
      <Avatar {...args} size="lg" />
    </div>
  ),
};

export const WithImage: Story = {
  args: { src: 'https://i.pravatar.cc/120?img=15', size: 'lg' },
};
