'use server';

import { getDemoStudentToken } from './auth';
import { GraphQLRequestError } from './graphql';
import { bookLesson, type BookLessonInput } from './queries';

export interface BookResult {
  ok: boolean;
  /** Present when `ok` is false: the GraphQL message or a generic code. */
  error?: string;
}

/**
 * Server Action: authenticate as the demo student and book a lesson. The token
 * is minted and used entirely on the server; the client only sees ok/error.
 */
export async function bookLessonAction(input: BookLessonInput): Promise<BookResult> {
  try {
    const token = await getDemoStudentToken();
    await bookLesson(input, token);
    return { ok: true };
  } catch (err) {
    const error = err instanceof GraphQLRequestError ? err.message : 'BOOKING_FAILED';
    return { ok: false, error };
  }
}
