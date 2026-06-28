import { type FormEvent, type JSX, useState } from 'react';
import { Button, Card, Modal, Skeleton } from '@ermulaku/ui';
import {
  type CreateServiceInput,
  type Service,
  type ServiceType,
  useCreateServiceMutation,
  useDeleteServiceMutation,
  useGetMyServicesQuery,
  useSetServiceActiveMutation,
} from '../../store/api';
import { useToast } from '../../components/ToastProvider';
import { money } from '../../lib/format';

const TYPE_LABEL: Record<ServiceType, string> = {
  ONE_ON_ONE: '1:1',
  GROUP: 'Group',
  PACKAGE: 'Package',
};
const TYPE_TONE: Record<ServiceType, string> = {
  ONE_ON_ONE: 'svc-pill--primary',
  GROUP: 'svc-pill--info',
  PACKAGE: 'svc-pill--accent',
};

const EMPTY: CreateServiceInput = {
  name: '',
  type: 'ONE_ON_ONE',
  level: 'ADVANCED',
  description: '',
  priceCents: 5000,
  durationMin: 60,
  lessonsCount: 1,
};

function ServiceCard({ service }: { service: Service }): JSX.Element {
  const [setActive] = useSetServiceActiveMutation();
  const [del] = useDeleteServiceMutation();
  const toast = useToast();
  return (
    <Card className={`svc${service.isActive ? '' : ' svc--hidden'}`}>
      <div className="svc__head">
        <span className={`svc-pill ${TYPE_TONE[service.type]}`}>{TYPE_LABEL[service.type]}</span>
        <span className={`svc__dot${service.isActive ? ' svc__dot--live' : ''}`}>
          {service.isActive ? 'Live' : 'Hidden'}
        </span>
      </div>
      <h3 className="svc__name">{service.name}</h3>
      <div className="muted svc__level">{service.level.toLowerCase()}</div>
      {service.description && <p className="svc__desc">{service.description}</p>}
      <div className="svc__foot">
        <div>
          <span className="svc__price">{money(service.priceCents)}</span>
          <span className="muted">
            {' '}
            · {service.durationMin} min{service.lessonsCount > 1 ? ` · ${service.lessonsCount} lessons` : ''}
          </span>
        </div>
        <div className="svc__actions">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void setActive({ id: service.id, isActive: !service.isActive });
            }}
          >
            {service.isActive ? 'Hide' : 'Show'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void del(service.id)
                .unwrap()
                .then(() => toast('Service removed'));
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function CatalogScreen(): JSX.Element {
  const { data: services, isLoading } = useGetMyServicesQuery();
  const [create, { isLoading: creating }] = useCreateServiceMutation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateServiceInput>(EMPTY);
  const toast = useToast();

  function submit(e: FormEvent): void {
    e.preventDefault();
    void create(form)
      .unwrap()
      .then(() => {
        toast('Service added');
        setOpen(false);
        setForm(EMPTY);
      });
  }

  return (
    <div className="catalog">
      <div className="catalog__head">
        <p className="muted">{services?.length ?? 0} services on your catalog.</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          New service
        </Button>
      </div>

      {isLoading ? (
        <Skeleton height={180} />
      ) : (
        <div className="catalog__grid">
          {services?.map((s) => <ServiceCard key={s.id} service={s} />)}
          <button type="button" className="catalog__add" onClick={() => setOpen(true)}>
            + Add a new subject or package
          </button>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New service">
        <form className="svc-form" onSubmit={submit}>
          <label className="login__field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
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
                onChange={(e) =>
                  setForm({ ...form, level: e.target.value as CreateServiceInput['level'] })
                }
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
    </div>
  );
}
