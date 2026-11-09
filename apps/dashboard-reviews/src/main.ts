import { initFederation } from '@angular-architects/native-federation';

/**
 * Standalone mode only. When the dashboard loads this remote it fetches
 * remoteEntry.json and imports the exposed `./routes` directly — this file
 * never runs there. Opened on its own (:3101), the remote is its own host:
 * an empty remote map, then the standalone app from bootstrap.ts.
 */
initFederation(
  {},
  {
    hostRemoteEntry: { url: './remoteEntry.json' },
  },
)
  .catch((err: unknown) => console.error(err))
  .then(() => import('./bootstrap'))
  .catch((err: unknown) => console.error(err));
