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
  tagTypes: ['Tutor', 'Booking', 'MeTutor'],
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
  useGetTutorsQuery,
  useGetBookingsQuery,
  useUpdateBookingStatusMutation,
  useUpdateTutorHoursMutation,
} = api;
