// Writes the production federation.manifest.json into the build output, so the
// dashboard loads the Reviews remote from its deployed URL.
//
//   REVIEWS_REMOTE_URL=https://reviews.example.com node scripts/write-federation-manifest.mjs
//
// The committed public/federation.manifest.json is the development one
// (http://localhost:3101). It is replaced after the build, in dist/, so the
// remote's URL is never baked into the bundle: moving the remote only needs this
// file rewritten (and the env var changed), not a rebuild of the dashboard code.
// Fails when the variable is missing, like API_URL in vercel.json.
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'dist',
  'dashboard-ng',
  'browser',
);
const raw = process.env.REVIEWS_REMOTE_URL;

if (!raw) {
  console.error(
    'REVIEWS_REMOTE_URL is not set (the Reviews remote origin, e.g. https://reviews.example.com).',
  );
  process.exit(1);
}
let url;
try {
  url = new URL(raw);
} catch {
  console.error(`REVIEWS_REMOTE_URL is not a URL: ${raw}`);
  process.exit(1);
}
if (!existsSync(outDir)) {
  console.error(`${outDir} does not exist — build the dashboard first.`);
  process.exit(1);
}

const remoteEntry = new URL('remoteEntry.json', url.href.endsWith('/') ? url.href : `${url.href}/`);
const manifest = { reviews: remoteEntry.href };
writeFileSync(join(outDir, 'federation.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`federation.manifest.json → ${JSON.stringify(manifest)}`);
