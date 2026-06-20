import { type PayloadAction, createSlice } from '@reduxjs/toolkit';

export interface UiState {
  /** The tutor whose calendar / bookings the dashboard is showing. */
  selectedTutorId: string | null;
}

const initialState: UiState = { selectedTutorId: null };

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    selectTutor(state, action: PayloadAction<string | null>) {
      state.selectedTutorId = action.payload;
    },
  },
});

export const { selectTutor } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
