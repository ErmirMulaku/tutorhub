import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Modal } from './Modal.js';
import { Button } from './Button.js';

const meta: Meta<typeof Modal> = {
  title: 'Primitives/Modal',
  component: Modal,
};
export default meta;

type Story = StoryObj<typeof Modal>;

export const BookingSheet: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open booking sheet</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Confirm your lesson">
          <p style={{ color: 'var(--th-text-muted)' }}>
            Monday, 10:00–11:00 with Amara Okafor. The enter/exit animates on transform and opacity
            only.
          </p>
          <Button block onClick={() => setOpen(false)}>
            Confirm booking
          </Button>
        </Modal>
      </>
    );
  },
};
