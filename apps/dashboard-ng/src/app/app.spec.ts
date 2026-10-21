import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the TutorHub brand and the configured API URL', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.login__brand')?.textContent).toContain('TutorHub');
    // The `define` default from angular.json, same as the React env.ts fallback.
    expect(el.querySelector('.login__subtitle')?.textContent).toContain('http://localhost:4000');
  });
});
