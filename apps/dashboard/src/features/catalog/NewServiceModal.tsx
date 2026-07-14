import { type FormEvent, type JSX, useState } from 'react';
import { Button, Modal } from '@ermulaku/ui';
import {
  type CreateServiceInput,
  type ServiceType,
  useCreateServiceMutation,
} from '../../store/api';
import { useToast } from '../../components/ToastProvider';

export const EMPTY_SERVICE: CreateServiceInput = {
  name: '',
  type: 'ONE_ON_ONE',
  level: 'ADVANCED',
  description: '',
  priceCents: 5000,
  durationMin: 60,
  lessonsCount: 1,
};

interface NewServiceModalProps {
  open: boolean;
  onClose: () => void;
  /** Extra class on the modal panel — used to scope onboarding's light theme. */
  className?: string;
}

/**
 * The "New service" modal + form, shared by the Catalog screen and the
 * onboarding Subjects step so both add subjects/packages the exact same way.
 * Creating invalidates the `Service` tag, so any `useGetMyServicesQuery` list
 * (catalog grid or onboarding cards) refetches automatically.
 */
export function NewServiceModal({ open, onClose, className }: NewServiceModalProps): JSX.Element {
  const [create, { isLoading: creating }] = useCreateServiceMutation();
  const [form, setForm] = useState<CreateServiceInput>(EMPTY_SERVICE);
  const toast = useToast();

  function submit(e: FormEvent): void {
    e.preventDefault();
    void create(form)
      .unwrap()
      .then(() => {
        toast('Service added');
        onClose();
        setForm(EMPTY_SERVICE);
      });
  }

  return (
    <Modal open={open} onClose={onClose} title="New service" className={className}>
      <form className="svc-form" onSubmit={submit}>
        <label className="login__field">
          <span>Name</span>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </label>
        <div className="svc-form__row">
          <label className="login__field">
            <span>Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ServiceType })}
            >
              <option value="ONE_ON_ONE">1:1</option>
              <option value="GROUP">Group</option>
              <option value="PACKAGE">Package</option>
            </select>
          </label>
          <label className="login__field">
            <span>Level</span>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as CreateServiceInput['level'] })}
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </label>
        </div>
        <div className="svc-form__row">
          <label className="login__field">
            <span>Price (USD)</span>
            <input
              type="number"
              min={0}
              value={form.priceCents / 100}
              onChange={(e) => setForm({ ...form, priceCents: Number(e.target.value) * 100 })}
            />
          </label>
          <label className="login__field">
            <span>Duration (min)</span>
            <input
              type="number"
              min={15}
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            />
          </label>
          <label className="login__field">
            <span>Lessons</span>
            <input
              type="number"
              min={1}
              value={form.lessonsCount}
              onChange={(e) => setForm({ ...form, lessonsCount: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="login__field">
          <span>Description</span>
          <input
            value={form.description ?? ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <Button type="submit" block disabled={creating}>
          {creating ? 'Adding…' : 'Add service'}
        </Button>
      </form>
    </Modal>
  );
}
