import { readdirSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import type { PrismaService } from '../prisma/prisma.service.js';
import { schemaStatus } from './schema-status.js';

// The real migration folders this code ships with.
const ALL = readdirSync(new URL('../../prisma/migrations', import.meta.url))
  .filter((name) => /^\d{14}_/.test(name))
  .sort();

function prismaWithApplied(names: string[]): PrismaService {
  const rows = names.map((migration_name) => ({ migration_name }));
  return { $queryRaw: () => Promise.resolve(rows) } as unknown as PrismaService;
}

describe('schemaStatus', () => {
  it('reports nothing pending when every bundled migration is applied', async () => {
    const status = await schemaStatus(prismaWithApplied(ALL));
    expect(status).toEqual({
      latestMigration: ALL.at(-1),
      appliedMigrations: ALL.length,
      pending: [],
    });
  });

  it('lists the migrations the database is missing (code deployed ahead of schema)', async () => {
    const status = await schemaStatus(prismaWithApplied(ALL.slice(0, -2)));
    expect(status.pending).toEqual(ALL.slice(-2));
    expect(status.latestMigration).toBe(ALL.at(-3));
  });

  it('catches a gap, not only missing newest ones', async () => {
    const withoutOld = ALL.filter((_, i) => i !== 3);
    const status = await schemaStatus(prismaWithApplied(withoutOld));
    expect(status.pending).toEqual([ALL[3]]);
    expect(status.latestMigration).toBe(ALL.at(-1)); // the newest *is* applied
  });
});
