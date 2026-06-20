import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card.js';
import { Avatar } from './Avatar.js';
import { StarRating } from './StarRating.js';
import { Tag } from './Tag.js';
import { Price } from './Price.js';

const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Plain: Story = {
  args: { children: 'A plain surface container.' },
};

export const TutorTile: Story = {
  args: { interactive: true },
  render: (args) => (
    <Card {...args} style={{ inlineSize: '20rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <Avatar name="Amara Okafor" size="lg" />
        <div>
          <strong>Amara Okafor</strong>
          <div style={{ marginBlockStart: '0.25rem' }}>
            <StarRating value={4.8} showValue count={42} />
          </div>
        </div>
      </div>
      <p style={{ color: 'var(--th-text-muted)' }}>
        Patient maths tutor — calculus, algebra, and exam prep.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBlockEnd: '0.75rem' }}>
        <Tag tone="advanced">Calculus</Tag>
        <Tag tone="beginner">Algebra</Tag>
      </div>
      <Price cents={3500} unit="/hr" locale="en" />
    </Card>
  ),
};
