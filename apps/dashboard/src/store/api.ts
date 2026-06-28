import {
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
  createApi,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import type { Booking, BookingStatus, Tutor, WorkingHours } from '@ermulaku/types';
import { API_URL } from '../env';
import { clearCredentials } from './auth-slice';
import type { RootState } from './store';

/** A GraphQL operation routed through the same base query as REST calls. */
export interface GraphQLRequest {
  document: string;
  variables?: Record<string, unknown>;
}

export type TutorBookingStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface TutorStudent {
  id: string;
  fullName: string;
  avatarColor: string | null;
}
export interface TutorSubject {
  id: string;
  name: string;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
}
export interface TutorBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: TutorBookingStatus;
  student: TutorStudent;
  subject: TutorSubject;
}
export interface DashboardSummary {
  lessonsToday: number;
  earningsWeekCents: number;
  avgRating: number | null;
  reviewCount: number;
  pendingCount: number;
  unreadMessages: number;
}

/** Reusable GraphQL selection for a tutor-facing booking. */
const BOOKING_FIELDS = `
  id startTime endTime status
  student { id fullName avatarColor }
  subject { id name level }
`;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.token;
    if (token !== null) headers.set('authorization', `Bearer ${token}`);
    return headers;
  },
});

/**
 * Base query that handles both REST (string / FetchArgs) and GraphQL requests.
 * GraphQL ops POST to `/graphql`, unwrap `data`, and surface `errors` as a
 * FetchBaseQueryError. A 401 (or a GraphQL auth error) clears the session.
 */
const baseQuery: BaseQueryFn<
  string | FetchArgs | { graphql: GraphQLRequest },
  unknown,
  FetchBaseQueryError
> = async (args, apiCtx, extraOptions) => {
  const isGraphQL = typeof args === 'object' && args !== null && 'graphql' in args;

  const result = await rawBaseQuery(
    isGraphQL
      ? {
          url: '/graphql',
          method: 'POST',
          body: { query: args.graphql.document, variables: args.graphql.variables ?? {} },
        }
      : args,
    apiCtx,
    extraOptions,
  );

  if (result.error?.status === 401) {
    apiCtx.dispatch(clearCredentials());
    return result;
  }

  if (isGraphQL && result.data !== undefined) {
    const body = result.data as { data?: unknown; errors?: { message: string }[] };
    if (body.errors && body.errors.length > 0) {
      const message = body.errors[0]?.message ?? 'GraphQL error';
      if (/token|unauth/i.test(message)) apiCtx.dispatch(clearCredentials());
      return { error: { status: 'CUSTOM_ERROR', error: message, data: body.errors } };
    }
    return { data: body.data };
  }

  return result;
};

/** RTK Query data layer over REST + GraphQL. Live WebSocket events patch this cache. */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: ['Tutor', 'Booking', 'MeTutor', 'DashboardSummary'],
  endpoints: (build) => ({
    // --- Tutor identity (GraphQL) ---
    getMeTutor: build.query<{ id: string; name: string; headline: string | null }, void>({
      query: () => ({
        graphql: { document: `{ meTutor { id name headline } }` },
      }),
      transformResponse: (r: { meTutor: { id: string; name: string; headline: string | null } }) =>
        r.meTutor,
      providesTags: ['MeTutor'],
    }),

    // --- Dashboard / Calendar / Lessons (tutor GraphQL) ---
    getDashboardSummary: build.query<DashboardSummary, void>({
      query: () => ({
        graphql: {
          document: `{ dashboardSummary { lessonsToday earningsWeekCents avgRating reviewCount pendingCount unreadMessages } }`,
        },
      }),
      transformResponse: (r: { dashboardSummary: DashboardSummary }) => r.dashboardSummary,
      providesTags: ['DashboardSummary'],
    }),
    getTodaySchedule: build.query<TutorBooking[], void>({
      query: () => ({ graphql: { document: `{ todaySchedule { ${BOOKING_FIELDS} } }` } }),
      transformResponse: (r: { todaySchedule: TutorBooking[] }) => r.todaySchedule,
      providesTags: ['Booking'],
    }),
    getTutorBookings: build.query<
      TutorBooking[],
      { status?: TutorBookingStatus; from?: string; to?: string } | void
    >({
      query: (args) => ({
        graphql: {
          document: `query($status: BookingStatus, $from: String, $to: String) {
            tutorBookings(status: $status, from: $from, to: $to) { ${BOOKING_FIELDS} }
          }`,
          variables: {
            status: args && 'status' in args ? args.status : undefined,
            from: args && 'from' in args ? args.from : undefined,
            to: args && 'to' in args ? args.to : undefined,
          },
        },
      }),
      transformResponse: (r: { tutorBookings: TutorBooking[] }) => r.tutorBookings,
      providesTags: ['Booking'],
    }),
    acceptBooking: build.mutation<{ id: string }, string>({
      query: (id) => ({
        graphql: {
          document: `mutation($id: ID!){ acceptBooking(id: $id){ id status } }`,
          variables: { id },
        },
      }),
      invalidatesTags: ['Booking', 'DashboardSummary'],
    }),
    declineBooking: build.mutation<{ id: string }, string>({
      query: (id) => ({
        graphql: {
          document: `mutation($id: ID!){ declineBooking(id: $id){ id status } }`,
          variables: { id },
        },
      }),
      invalidatesTags: ['Booking', 'DashboardSummary'],
    }),
    completeBooking: build.mutation<{ id: string }, string>({
      query: (id) => ({
        graphql: {
          document: `mutation($id: ID!){ completeBooking(id: $id){ id status } }`,
          variables: { id },
        },
      }),
      invalidatesTags: ['Booking', 'DashboardSummary'],
    }),

    // --- Existing REST endpoints (kept during the GraphQL migration) ---
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
  useGetMeTutorQuery,
  useGetDashboardSummaryQuery,
  useGetTodayScheduleQuery,
  useGetTutorBookingsQuery,
  useAcceptBookingMutation,
  useDeclineBookingMutation,
  useCompleteBookingMutation,
  useGetTutorsQuery,
  useGetBookingsQuery,
  useUpdateBookingStatusMutation,
  useUpdateTutorHoursMutation,
} = api;
