import { Injectable, inject } from '@angular/core';
import { type Observable, map, tap } from 'rxjs';
import { CacheTags } from './cache-tags';
import { GraphqlClient } from './graphql-client';
import type { CreateServiceInput, Service } from './models';

/** The tutor's catalog of services. Documents copied from api.ts. */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly gql = inject(GraphqlClient);
  private readonly tags = inject(CacheTags);

  myServices(): Observable<Service[]> {
    return this.gql
      .request<{
        myServices: Service[];
      }>(
        `{ myServices { id name type level description priceCents durationMin lessonsCount isActive } }`,
      )
      .pipe(map((r) => r.myServices));
  }

  createService(input: CreateServiceInput): Observable<{ id: string }> {
    return this.gql
      .request<{
        createService: { id: string };
      }>(`mutation($input: CreateServiceInput!){ createService(input: $input){ id } }`, { input })
      .pipe(
        map((r) => r.createService),
        tap(() => this.tags.invalidate('Service')),
      );
  }

  setServiceActive(id: string, isActive: boolean): Observable<void> {
    return this.gql
      .request(
        `mutation($id: ID!, $isActive: Boolean!){ setServiceActive(id: $id, isActive: $isActive){ id isActive } }`,
        { id, isActive },
      )
      .pipe(
        map(() => undefined),
        tap(() => this.tags.invalidate('Service')),
      );
  }

  deleteService(id: string): Observable<void> {
    return this.gql.request(`mutation($id: ID!){ deleteService(id: $id) }`, { id }).pipe(
      map(() => undefined),
      tap(() => this.tags.invalidate('Service')),
    );
  }
}
