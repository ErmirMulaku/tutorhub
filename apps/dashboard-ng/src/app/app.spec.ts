import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import { App } from './app';
import { UiActions, uiFeature } from './core/ui/ui.store';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideStore(), provideState(uiFeature)],
    }).compileComponents();
  });

  it('reflects the theme and accent from the store onto <html>', async () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(Store);
    const root = document.documentElement;

    store.dispatch(UiActions.setTheme({ theme: 'dark' }));
    store.dispatch(UiActions.setAccent({ accent: 'plum' }));
    await fixture.whenStable();

    expect(root.dataset['theme']).toBe('dark');
    expect(root.dataset['accent']).toBe('plum');
  });
});
