import { type JSX, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@ermulaku/ui';
import { useDeleteTutorAccountMutation } from '../../store/api';
import { useAppDispatch } from '../../store/hooks';
import { clearCredentials } from '../../store/auth-slice';

interface Props {
  /** The account's name, retyped to confirm. */
  name: string;
}

/**
 * Permanent account deletion.
 *
 * Deliberately awkward: this removes lessons students have already taken and
 * the records of what they paid, and none of it can be restored. Retyping the
 * account name is there to make it a decision rather than a misclick — a lone
 * button next to "Save profile" is too easy to hit by accident.
 */
export function DeleteAccountCard({ name }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [deleteAccount, { isLoading }] = useDeleteTutorAccountMutation();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const matches = confirm.trim() === name.trim() && name.trim() !== '';

  function remove(): void {
    setError(null);
    void deleteAccount()
      .unwrap()
      .then(() => {
        // The session's tutor no longer exists, so drop it before anything can
        // refetch with a token pointing at a deleted account.
        dispatch(clearCredentials());
        void navigate('/login', { replace: true });
      })
      .catch(() => setError('Could not delete your account. Nothing was changed.'));
  }

  return (
    <Card>
      <h3 className="card-head__title">Delete account</h3>
      {!open ? (
        <>
          <p className="muted">
            Permanently delete your account and everything on it. This cannot be undone.
          </p>
          <Button variant="ghost" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </>
      ) : (
        <>
          <p className="muted">This permanently deletes:</p>
          <ul className="muted">
            <li>your profile, subjects, catalog and availability</li>
            <li>every lesson you have taught, including your students' history of them</li>
            <li>the payment records for those lessons, and your earnings history</li>
            <li>reviews students have written about you</li>
          </ul>
          <p className="muted">
            Students with a lesson booked ahead will be told it is cancelled. Nothing here can be
            restored, and no refunds are issued.
          </p>
          <label className="login__field">
            <span>
              Type <strong>{name}</strong> to confirm
            </span>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
            />
          </label>
          {error !== null && <p className="error">{error}</p>}
          <div className="settings__danger-actions">
            <Button variant="ghost" onClick={() => { setOpen(false); setConfirm(''); }}>
              Cancel
            </Button>
            <Button onClick={remove} disabled={!matches || isLoading}>
              {isLoading ? 'Deleting…' : 'Delete my account permanently'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
