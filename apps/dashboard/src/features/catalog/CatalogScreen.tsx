import { type JSX, useState } from 'react';
import { Button, Card, Skeleton } from '@ermulaku/ui';
import {
  type Service,
  type ServiceType,
  useDeleteServiceMutation,
  useGetMyServicesQuery,
  useSetServiceActiveMutation,
} from '../../store/api';
import { useToast } from '../../components/ToastProvider';
import { money } from '../../lib/format';
import { NewServiceModal } from './NewServiceModal';

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
  const [open, setOpen] = useState(false);

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

      <NewServiceModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
