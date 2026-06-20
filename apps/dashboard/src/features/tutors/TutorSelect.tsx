import type { ChangeEvent, JSX } from 'react';
import { useGetTutorsQuery } from '../../store/api';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { selectTutor } from '../../store/ui-slice';

export function TutorSelect(): JSX.Element {
  const dispatch = useAppDispatch();
  const selectedTutorId = useAppSelector((state) => state.ui.selectedTutorId);
  const { data: tutors, isLoading, isError } = useGetTutorsQuery();

  if (isLoading) return <p>Loading tutors…</p>;
  if (isError || tutors === undefined) return <p className="error">Failed to load tutors.</p>;

  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    dispatch(selectTutor(event.target.value === '' ? null : event.target.value));
  };

  return (
    <label className="tutor-select">
      <span>Tutor</span>
      <select value={selectedTutorId ?? ''} onChange={onChange}>
        <option value="">— select a tutor —</option>
        {tutors.map((tutor) => (
          <option key={tutor.id} value={tutor.id}>
            {tutor.name}
          </option>
        ))}
      </select>
    </label>
  );
}
