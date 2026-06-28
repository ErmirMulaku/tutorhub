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

export type ServiceType = 'ONE_ON_ONE' | 'GROUP' | 'PACKAGE';
export interface Service {
  id: string;
  name: string;
  type: ServiceType;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  description: string | null;
  priceCents: number;
  durationMin: number;
  lessonsCount: number;
  isActive: boolean;
}
export interface CreateServiceInput {
  name: string;
  type: ServiceType;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  description?: string;
  priceCents: number;
  durationMin: number;
  lessonsCount: number;
}
export interface WorkingHour {
  day: number;
  start: string;
  end: string;
}
export interface TimeOff {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}
export interface MyAvailability {
  workingHours: WorkingHour[];
  bufferMinutes: number;
  minNoticeHours: number;
  maxLessonsPerDay: number;
  timeOff: TimeOff[];
}

export interface Conversation {
  id: string;
  studentName: string;
  studentAvatarColor: string | null;
  subjectName: string | null;
  lastMessageAt: string;
  preview: string | null;
  unread: number;
}
export interface ChatMessage {
  id: string;
  senderKind: 'TUTOR' | 'STUDENT';
  body: string;
  createdAt: string;
}

export type PayoutSchedule = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export interface EarningsSummary {
  availableCents: number;
  pendingCents: number;
  lifetimeCents: number;
  payoutMethod: string | null;
  payoutSchedule: PayoutSchedule;
}
export interface MonthlyEarning {
  month: string;
  netCents: number;
}
export interface Transaction {
  id: string;
  date: string;
  studentName: string;
  subjectName: string;
  netCents: number;
  feeCents: number;
  status: string;
}

export type PromotionState = 'ACTIVE' | 'SCHEDULED' | 'ENDED';
export type DiscountType = 'PERCENT' | 'FIXED';
export interface Promotion {
  id: string;
  name: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  state: PromotionState;
  expiresAt: string | null;
  redemptions: number;
}
export interface MarketingSummary {
  activePromotions: number;
  redemptions: number;
  giftCardsSoldCents: number;
}
export interface ReferralProgram {
  creditCents: number;
  referredCount: number;
  issuedCents: number;
}
export interface CreatePromotionInput {
  name: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
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
  tagTypes: [
    'Tutor',
    'Booking',
    'MeTutor',
    'DashboardSummary',
    'Service',
    'Availability',
    'Conversation',
    'Message',
    'Earnings',
    'Marketing',
  ],
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

    // --- Catalog (tutor GraphQL) ---
    getMyServices: build.query<Service[], void>({
      query: () => ({
        graphql: {
          document: `{ myServices { id name type level description priceCents durationMin lessonsCount isActive } }`,
        },
      }),
      transformResponse: (r: { myServices: Service[] }) => r.myServices,
      providesTags: ['Service'],
    }),
    createService: build.mutation<{ id: string }, CreateServiceInput>({
      query: (input) => ({
        graphql: {
          document: `mutation($input: CreateServiceInput!){ createService(input: $input){ id } }`,
          variables: { input },
        },
      }),
      invalidatesTags: ['Service'],
    }),
    setServiceActive: build.mutation<{ id: string }, { id: string; isActive: boolean }>({
      query: ({ id, isActive }) => ({
        graphql: {
          document: `mutation($id: ID!, $isActive: Boolean!){ setServiceActive(id: $id, isActive: $isActive){ id isActive } }`,
          variables: { id, isActive },
        },
      }),
      invalidatesTags: ['Service'],
    }),
    deleteService: build.mutation<boolean, string>({
      query: (id) => ({
        graphql: { document: `mutation($id: ID!){ deleteService(id: $id) }`, variables: { id } },
      }),
      invalidatesTags: ['Service'],
    }),

    // --- Availability self-service (tutor GraphQL) ---
    getMyAvailability: build.query<MyAvailability, void>({
      query: () => ({
        graphql: {
          document: `{ myAvailability { bufferMinutes minNoticeHours maxLessonsPerDay workingHours { day start end } timeOff { id label startDate endDate } } }`,
        },
      }),
      transformResponse: (r: { myAvailability: MyAvailability }) => r.myAvailability,
      providesTags: ['Availability'],
    }),
    updateWorkingHours: build.mutation<MyAvailability, WorkingHour[]>({
      query: (hours) => ({
        graphql: {
          document: `mutation($hours: [WorkingHourInput!]!){ updateWorkingHours(hours: $hours){ bufferMinutes } }`,
          variables: { hours: hours.map((h) => ({ day: h.day, start: h.start, end: h.end })) },
        },
      }),
      invalidatesTags: ['Availability'],
    }),
    updateBookingRules: build.mutation<
      MyAvailability,
      { bufferMinutes: number; minNoticeHours: number; maxLessonsPerDay: number }
    >({
      query: (rules) => ({
        graphql: {
          document: `mutation($rules: BookingRulesInput!){ updateBookingRules(rules: $rules){ bufferMinutes } }`,
          variables: { rules },
        },
      }),
      invalidatesTags: ['Availability'],
    }),
    addTimeOff: build.mutation<
      MyAvailability,
      { label: string; startDate: string; endDate: string }
    >({
      query: (input) => ({
        graphql: {
          document: `mutation($input: TimeOffInput!){ addTimeOff(input: $input){ bufferMinutes } }`,
          variables: { input },
        },
      }),
      invalidatesTags: ['Availability'],
    }),
    removeTimeOff: build.mutation<MyAvailability, string>({
      query: (id) => ({
        graphql: {
          document: `mutation($id: ID!){ removeTimeOff(id: $id){ bufferMinutes } }`,
          variables: { id },
        },
      }),
      invalidatesTags: ['Availability'],
    }),

    // --- Messaging (tutor GraphQL) ---
    getConversations: build.query<Conversation[], void>({
      query: () => ({
        graphql: {
          document: `{ conversations { id studentName studentAvatarColor subjectName lastMessageAt preview unread } }`,
        },
      }),
      transformResponse: (r: { conversations: Conversation[] }) => r.conversations,
      providesTags: ['Conversation'],
    }),
    getMessages: build.query<ChatMessage[], string>({
      query: (conversationId) => ({
        graphql: {
          document: `query($id: ID!){ messages(conversationId: $id){ id senderKind body createdAt } }`,
          variables: { id: conversationId },
        },
      }),
      transformResponse: (r: { messages: ChatMessage[] }) => r.messages,
      providesTags: ['Message'],
    }),
    sendMessage: build.mutation<{ id: string }, { conversationId: string; body: string }>({
      query: ({ conversationId, body }) => ({
        graphql: {
          document: `mutation($id: ID!, $body: String!){ sendMessage(conversationId: $id, body: $body){ id } }`,
          variables: { id: conversationId, body },
        },
      }),
      invalidatesTags: ['Message', 'Conversation'],
    }),
    markConversationRead: build.mutation<unknown, string>({
      query: (conversationId) => ({
        graphql: {
          document: `mutation($id: ID!){ markConversationRead(conversationId: $id){ id } }`,
          variables: { id: conversationId },
        },
      }),
      invalidatesTags: ['Conversation', 'DashboardSummary'],
    }),

    // --- Earnings (tutor GraphQL) ---
    getEarningsSummary: build.query<EarningsSummary, void>({
      query: () => ({
        graphql: {
          document: `{ earningsSummary { availableCents pendingCents lifetimeCents payoutMethod payoutSchedule } }`,
        },
      }),
      transformResponse: (r: { earningsSummary: EarningsSummary }) => r.earningsSummary,
      providesTags: ['Earnings'],
    }),
    getEarningsByMonth: build.query<MonthlyEarning[], void>({
      query: () => ({ graphql: { document: `{ earningsByMonth { month netCents } }` } }),
      transformResponse: (r: { earningsByMonth: MonthlyEarning[] }) => r.earningsByMonth,
      providesTags: ['Earnings'],
    }),
    getTransactions: build.query<Transaction[], void>({
      query: () => ({
        graphql: {
          document: `{ transactions { id date studentName subjectName netCents feeCents status } }`,
        },
      }),
      transformResponse: (r: { transactions: Transaction[] }) => r.transactions,
      providesTags: ['Earnings'],
    }),
    withdraw: build.mutation<EarningsSummary, void>({
      query: () => ({
        graphql: { document: `mutation { withdraw { availableCents } }` },
      }),
      invalidatesTags: ['Earnings'],
    }),

    // --- Marketing (tutor GraphQL) ---
    getMarketingSummary: build.query<MarketingSummary, void>({
      query: () => ({
        graphql: {
          document: `{ marketingSummary { activePromotions redemptions giftCardsSoldCents } }`,
        },
      }),
      transformResponse: (r: { marketingSummary: MarketingSummary }) => r.marketingSummary,
      providesTags: ['Marketing'],
    }),
    getPromotions: build.query<Promotion[], void>({
      query: () => ({
        graphql: {
          document: `{ promotions { id name code discountType discountValue state expiresAt redemptions } }`,
        },
      }),
      transformResponse: (r: { promotions: Promotion[] }) => r.promotions,
      providesTags: ['Marketing'],
    }),
    getReferralProgram: build.query<ReferralProgram, void>({
      query: () => ({
        graphql: { document: `{ referralProgram { creditCents referredCount issuedCents } }` },
      }),
      transformResponse: (r: { referralProgram: ReferralProgram }) => r.referralProgram,
      providesTags: ['Marketing'],
    }),
    createPromotion: build.mutation<{ id: string }, CreatePromotionInput>({
      query: (input) => ({
        graphql: {
          document: `mutation($input: CreatePromotionInput!){ createPromotion(input: $input){ id } }`,
          variables: { input },
        },
      }),
      invalidatesTags: ['Marketing'],
    }),
    endPromotion: build.mutation<{ id: string }, string>({
      query: (id) => ({
        graphql: {
          document: `mutation($id: ID!){ endPromotion(id: $id){ id state } }`,
          variables: { id },
        },
      }),
      invalidatesTags: ['Marketing'],
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
  useGetMyServicesQuery,
  useCreateServiceMutation,
  useSetServiceActiveMutation,
  useDeleteServiceMutation,
  useGetMyAvailabilityQuery,
  useUpdateWorkingHoursMutation,
  useUpdateBookingRulesMutation,
  useAddTimeOffMutation,
  useRemoveTimeOffMutation,
  useGetConversationsQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkConversationReadMutation,
  useGetEarningsSummaryQuery,
  useGetEarningsByMonthQuery,
  useGetTransactionsQuery,
  useWithdrawMutation,
  useGetMarketingSummaryQuery,
  useGetPromotionsQuery,
  useGetReferralProgramQuery,
  useCreatePromotionMutation,
  useEndPromotionMutation,
  useGetTutorsQuery,
  useGetBookingsQuery,
  useUpdateBookingStatusMutation,
  useUpdateTutorHoursMutation,
} = api;
