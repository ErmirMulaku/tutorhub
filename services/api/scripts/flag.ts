/**
 * View and change feature flags (docs/FRESHA_DEPTH_SPEC.md Block 7).
 *
 *   npx tsx scripts/flag.ts list
 *   npx tsx scripts/flag.ts set booking.v2_result --on --percent 10
 *   npx tsx scripts/flag.ts set booking.v2_result --allow <studentId>,<studentId>
 *   npx tsx scripts/flag.ts set outbox.publish --off        # kill switch
 *
 * Writes straight to the FeatureFlag table of DATABASE_URL (from .env unless
 * set). Each API instance caches a flag for 30 s, so a change reaches every
 * instance within 30 s — no deploy. See the rollout playbook in
 * docs/operations.md before widening a rollout.
 */
import 'dotenv/config';
import pg from 'pg';

interface FlagRow {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
  allowList: string[];
  updatedAt: Date;
}

function usage(): never {
  console.error(
    'usage: flag.ts list | set <key> [--on|--off] [--percent 0-100] [--allow id,id] [--clear-allow]',
  );
  process.exit(2);
}

function print(rows: FlagRow[]): void {
  for (const f of rows) {
    console.log(
      `${f.key}: ${f.enabled ? 'ON' : 'OFF'}, ${f.rolloutPercent}% rollout, ` +
        `${f.allowList.length} allow-listed, updated ${f.updatedAt.toISOString()}`,
    );
  }
}

async function main(): Promise<void> {
  const [command, key, ...options] = process.argv.slice(2);
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') throw new Error('Set DATABASE_URL.');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (command === 'list') {
      const { rows } = await client.query<FlagRow>('SELECT * FROM "FeatureFlag" ORDER BY key');
      if (rows.length === 0) console.log('No flags set (every flag uses its default).');
      print(rows);
      return;
    }
    if (command !== 'set' || key === undefined) usage();

    let enabled: boolean | null = null;
    let percent: number | null = null;
    let allow: string[] | null = null;
    for (let i = 0; i < options.length; i++) {
      const option = options[i];
      if (option === '--on') enabled = true;
      else if (option === '--off') enabled = false;
      else if (option === '--percent') percent = Number(options[++i]);
      else if (option === '--allow') allow = (options[++i] ?? '').split(',').filter(Boolean);
      else if (option === '--clear-allow') allow = [];
      else usage();
    }
    if (percent !== null && !(Number.isInteger(percent) && percent >= 0 && percent <= 100)) {
      throw new Error('--percent must be a whole number from 0 to 100.');
    }

    // Insert the flag if it's new (off, 0% by default), else change only what
    // was asked. Parameters, never string concatenation.
    const { rows } = await client.query<FlagRow>(
      `INSERT INTO "FeatureFlag" (key, enabled, "rolloutPercent", "allowList", "updatedAt")
       VALUES ($1, coalesce($2, false), coalesce($3, 0), coalesce($4, '{}'::text[]), now())
       ON CONFLICT (key) DO UPDATE SET
         enabled          = coalesce($2, "FeatureFlag".enabled),
         "rolloutPercent" = coalesce($3, "FeatureFlag"."rolloutPercent"),
         "allowList"      = coalesce($4, "FeatureFlag"."allowList"),
         "updatedAt"      = now()
       RETURNING *`,
      [key, enabled, percent, allow],
    );
    print(rows);
    console.log('Every API instance picks this up within 30 s (flag cache).');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
