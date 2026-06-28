import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import { authReducer } from './auth-slice';
import { uiReducer } from './ui-slice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    [api.reducerPath]: api.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
