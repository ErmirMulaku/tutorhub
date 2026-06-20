import type { JSX } from 'react';
import Logo from '../assets/logo.svg';
import { BookingsList } from '../features/bookings/BookingsList';
import { TutorSelect } from '../features/tutors/TutorSelect';

export function App(): JSX.Element {
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
        <section className="panel">
          <h2>Bookings</h2>
          <BookingsList />
        </section>
      </main>
    </div>
  );
}
