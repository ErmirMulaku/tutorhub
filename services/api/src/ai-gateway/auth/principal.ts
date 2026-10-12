import type { PrincipalKind } from '../../auth/auth-user.js';

/** The caller of the AI gateway — a student or a tutor, decoded from their JWT. */
export interface Principal {
  id: string;
  kind: PrincipalKind;
}

export interface RequestWithPrincipal {
  headers: { authorization?: string };
  principal?: Principal;
}
