import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { GraphqlBody, GraphqlErrorEntry } from '../api/graphql-client';
import { SKIP_AUTH } from './auth.interceptor';

interface AuthPayload {
  accessToken: string;
  tutorId: string;
}
interface SignupPayload {
  tutorId: string;
  requiresVerification: boolean;
  devCode: string | null;
  demoCode: string | null;
}
interface ResendPayload {
  devCode: string | null;
  demoCode: string | null;
}

function isGraphqlBody(value: unknown): value is GraphqlBody<unknown> {
  return typeof value === 'object' && value !== null && ('errors' in value || 'data' in value);
}

/**
 * The pre-session auth calls (port of features/auth/api.ts). They return the
 * whole GraphQL body rather than throwing, because the screens branch on the
 * error *code* (e.g. EMAIL_NOT_VERIFIED). Sent with SKIP_AUTH: no token, like
 * the React app's raw `fetch`. A GraphQL error delivered with a non-2xx status
 * is still returned as a body — `fetch` never threw on those either; only a
 * real network failure errors the stream.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  signin(email: string, password: string): Observable<GraphqlBody<{ tutorSignin: AuthPayload }>> {
    return this.post(
      `mutation($e:String!,$p:String!){ tutorSignin(email:$e,password:$p){ accessToken tutorId } }`,
      { e: email, p: password },
    );
  }

  signup(
    fullName: string,
    email: string,
    password: string,
  ): Observable<GraphqlBody<{ tutorSignup: SignupPayload }>> {
    return this.post(
      `mutation($n:String!,$e:String!,$p:String!){ tutorSignup(fullName:$n,email:$e,password:$p){ tutorId requiresVerification devCode demoCode } }`,
      { n: fullName, e: email, p: password },
    );
  }

  verifyEmail(
    email: string,
    code: string,
  ): Observable<GraphqlBody<{ tutorVerifyEmail: AuthPayload }>> {
    return this.post(
      `mutation($e:String!,$c:String!){ tutorVerifyEmail(email:$e,code:$c){ accessToken tutorId } }`,
      { e: email, c: code },
    );
  }

  resendCode(
    email: string,
  ): Observable<GraphqlBody<{ resendTutorVerificationCode: ResendPayload }>> {
    return this.post(
      `mutation($e:String!){ resendTutorVerificationCode(email:$e){ devCode demoCode } }`,
      { e: email },
    );
  }

  private post<T>(query: string, variables: Record<string, unknown>): Observable<GraphqlBody<T>> {
    return this.http
      .post<
        GraphqlBody<T>
      >(`${environment.apiUrl}/graphql`, { query, variables }, { context: new HttpContext().set(SKIP_AUTH, true) })
      .pipe(
        catchError((err: unknown) =>
          err instanceof HttpErrorResponse && isGraphqlBody(err.error)
            ? of(err.error as GraphqlBody<T>)
            : throwError(() => err),
        ),
      );
  }
}

/**
 * True when sign-in failed only because the address is unverified — matched on
 * the API's EMAIL_NOT_VERIFIED code, not the message, so copy edits can't break it.
 */
export function isEmailNotVerified(errors: GraphqlErrorEntry[] | undefined): boolean {
  return errors?.some((e) => e.extensions?.code === 'EMAIL_NOT_VERIFIED') ?? false;
}
