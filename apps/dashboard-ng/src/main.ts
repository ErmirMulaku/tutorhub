import { initFederation } from '@angular-architects/native-federation';

/**
 * Native Federation starts first: it reads the remote list from
 * federation.manifest.json and builds the import map that lets the remotes
 * share our Angular, NgRx and kit. Only then is the app itself loaded, from
 * bootstrap.ts, so every shared package resolves through that import map.
 *
 * A failure here (e.g. the manifest can't be fetched) is logged and the app
 * still starts — just without remotes.
 */
initFederation('federation.manifest.json', {
  hostRemoteEntry: { url: './remoteEntry.json' },
})
  .catch((err: unknown) => console.error(err))
  .then(() => import('./bootstrap'))
  .catch((err: unknown) => console.error(err));
