import type { JSX } from 'react';
import Logo from '../assets/logo.svg';
import { CalendarView } from '../features/availability/CalendarView';
import { BookingsList } from '../features/bookings/BookingsList';
import { useLiveBookings } from '../features/live/use-live-bookings';
import { TutorSelect } from '../features/tutors/TutorSelect';
import { useAppSelector } from '../store/hooks';

export function App(): JSX.Element {
  const selectedTutorId = useAppSelector((state) => state.ui.selectedTutorId);
  useLiveBookings(selectedTutorId);

  return (
    <div className="app">
      <header className="app__header">
        <Logo className="app__logo" />
        <h1>TutorHub Dashboard</h1>
      </header>
      <main className="app__main">
        <section className="panel">
          <TutorSelect />
        </section>
        <CalendarView />
        <section className="panel">
          <h2>Bookings</h2>
          <BookingsList />
        </section>
      </main>
    </div>
  );
}
