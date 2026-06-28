import { type PayloadAction, createSlice } from '@reduxjs/toolkit';

const TOKEN_KEY = 'th_tutor_token';
const TUTOR_KEY = 'th_tutor_id';

export interface AuthState {
  token: string | null;
  tutorId: string | null;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  token: read(TOKEN_KEY),
  tutorId: read(TUTOR_KEY),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; tutorId: string }>) {
      state.token = action.payload.token;
      state.tutorId = action.payload.tutorId;
      try {
        localStorage.setItem(TOKEN_KEY, action.payload.token);
        localStorage.setItem(TUTOR_KEY, action.payload.tutorId);
      } catch {
        /* storage unavailable — keep in-memory only */
      }
    },
    clearCredentials(state) {
      state.token = null;
      state.tutorId = null;
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TUTOR_KEY);
      } catch {
        /* ignore */
      }
    },
  },
});

export const { setCredentials, clearCredentials } = authSlice.actions;
export const authReducer = authSlice.reducer;
