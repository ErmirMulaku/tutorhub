import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

type Env = { DATABASE_URL: string };

// Prisma 7 no longer auto-loads `.env`, and the connection URL for Migrate now
// lives here (not in the schema). `dotenv/config` above populates `process.env`.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env<Env>('DATABASE_URL'),
  },
});
