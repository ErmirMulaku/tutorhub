import { describe, expect, it } from '@jest/globals';
import { selectTutor, uiReducer } from './ui-slice';

describe('ui slice', () => {
  it('starts with no tutor selected', () => {
    expect(uiReducer(undefined, { type: '@@init' })).toEqual({ selectedTutorId: null });
  });

  it('selects a tutor', () => {
    const state = uiReducer({ selectedTutorId: null }, selectTutor('tutor-1'));
    expect(state.selectedTutorId).toBe('tutor-1');
  });

  it('clears the selection', () => {
    const state = uiReducer({ selectedTutorId: 'tutor-1' }, selectTutor(null));
    expect(state.selectedTutorId).toBeNull();
  });
});
