import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * The migrations this build of the API was written against: the folder names
 * in `prisma/migrations` (they're copied into the image next to `dist/`).
 * From `src/health` or `dist/health`, that's two levels up.
 */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../prisma/migrations');

function bundledMigrations(): string[] {
  try {
    return readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^\d{14}_/.test(name))
      .sort();
  } catch {
    return []; // no folder (unusual layout): nothing to compare against
  }
}
const BUNDLED = bundledMigrations();

export interface SchemaStatus {
  /** Newest migration the database has applied, by name (they sort by date). */
  latestMigration: string | null;
  appliedMigrations: number;
  /** Migrations this code expects that the database doesn't have yet. */
  pending: string[];
}

/**
 * Compare the database's applied migrations with the ones this code needs.
 *
 * Why: the deploy doesn't run migrations (see deploy-api.yml), so code can
 * reach production before its schema — on 2026-10-23 that broke the discover
 * page ("column Tutor.ratingSum does not exist") while `/ready` still said
 * 200. Now `/ready` says 503 in that state, and the deploy workflow reads
 * `latestMigration` / `appliedMigrations` to refuse to ship code whose
 * migrations haven't been run.
 */
export async function schemaStatus(prisma: PrismaService): Promise<SchemaStatus> {
  const rows = await prisma.$queryRaw<{ migration_name: string }[]>`
    SELECT migration_name FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name`;
  const applied = new Set(rows.map((row) => row.migration_name));
  return {
    latestMigration: rows.at(-1)?.migration_name ?? null,
    appliedMigrations: applied.size,
    pending: BUNDLED.filter((name) => !applied.has(name)),
  };
}
