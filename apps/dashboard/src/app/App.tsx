import type { JSX } from 'react';
import Logo from '../assets/logo.svg';

export function App(): JSX.Element {
  return (
    <div className="app">
      <header className="app__header">
        <Logo className="app__logo" />
        <h1>TutorHub Dashboard</h1>
      </header>
      <main className="app__main">
        <p>Tutor back office — calendar, bookings, and live updates.</p>
      </main>
    </div>
  );
}
