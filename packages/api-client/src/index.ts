/**
 * `@ermulaku/api-client` — a small typed client for the TutorHub API, shared by
 * the Expo mobile app. Reads/booking over GraphQL; dev-login over REST.
 *
 * @packageDocumentation
 */

export { TutorHubClient, ApiError } from './client.js';
export type {
  TutorHubClientOptions,
  ClientTutor,
  ClientSubject,
  ClientSlot,
  TutorPage,
  ListTutorsParams,
} from './client.js';
