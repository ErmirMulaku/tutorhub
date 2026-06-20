import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Booking, BookingStatus, Tutor, WorkingHours } from '@ermulaku/types';
import { API_URL } from '../env';

/** RTK Query data layer over the REST API. Live WebSocket events patch this cache. */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: API_URL }),
  tagTypes: ['Tutor', 'Booking'],
  endpoints: (build) => ({
    getTutors: build.query<Tutor[], void>({
      query: () => '/tutors',
      providesTags: ['Tutor'],
    }),
    getBookings: build.query<Booking[], { tutorId: string; status?: BookingStatus }>({
      query: (params) => ({ url: '/bookings', params }),
      providesTags: ['Booking'],
    }),
    updateBookingStatus: build.mutation<Booking, { id: string; status: BookingStatus }>({
      query: ({ id, status }) => ({
        url: `/bookings/${id}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Booking'],
    }),
    updateTutorHours: build.mutation<Tutor, { id: string; workingHours: WorkingHours[] }>({
      query: ({ id, workingHours }) => ({
        url: `/tutors/${id}`,
        method: 'PATCH',
        body: { workingHours },
      }),
      invalidatesTags: ['Tutor'],
    }),
  }),
});

export const {
  useGetTutorsQuery,
  useGetBookingsQuery,
  useUpdateBookingStatusMutation,
  useUpdateTutorHoursMutation,
} = api;
