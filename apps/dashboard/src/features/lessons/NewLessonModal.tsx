import { type FormEvent, type JSX, useEffect, useState } from 'react';
import { Button, Modal } from '@ermulaku/ui';
import {
  useCreateLessonMutation,
  useGetMyStudentsQuery,
  useGetMySubjectsQuery,
} from '../../store/api';
import { useToast } from '../../components/ToastProvider';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setNewLessonOpen } from '../../store/ui-slice';

/** Tutor-initiated booking — opened from the topbar "New lesson" button. */
export function NewLessonModal(): JSX.Element {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.newLessonOpen);
  const { data: students } = useGetMyStudentsQuery(undefined, { skip: !open });
  const { data: subjects } = useGetMySubjectsQuery(undefined, { skip: !open });
  const [create, { isLoading }] = useCreateLessonMutation();
  const toast = useToast();

  const [studentId, setStudentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [startTime, setStartTime] = useState('');

  // Default the pickers once data arrives.
  useEffect(() => {
    if (students && students.length > 0 && studentId === '') setStudentId(students[0]?.id ?? '');
  }, [students, studentId]);
  useEffect(() => {
    if (subjects && subjects.length > 0 && subjectId === '') setSubjectId(subjects[0]?.id ?? '');
  }, [subjects, subjectId]);

  function close(): void {
    dispatch(setNewLessonOpen(false));
  }

  function submit(e: FormEvent): void {
    e.preventDefault();
    if (!studentId || !subjectId || startTime === '') return;
    void create({ studentId, subjectId, startTime: new Date(startTime).toISOString() })
      .unwrap()
      .then(() => {
        toast('Lesson booked');
        setStartTime('');
        close();
      })
      .catch(() => toast('Could not book the lesson'));
  }

  return (
    <Modal open={open} onClose={close} title="New lesson">
      <form className="svc-form" onSubmit={submit}>
        <label className="login__field">
          <span>Student</span>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            {students?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className="login__field">
          <span>Subject</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
            {subjects?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.level.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="login__field">
          <span>Date & time</span>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <Button type="submit" block disabled={isLoading || !studentId || !subjectId}>
          {isLoading ? 'Booking…' : 'Book lesson'}
        </Button>
      </form>
    </Modal>
  );
}
