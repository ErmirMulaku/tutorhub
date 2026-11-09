import { initFederation } from '@angular-architects/native-federation';
import { MANIFEST_URL } from './app/core/federation/manifest-url';

/**
 * Native Federation starts first: it reads the remote list from
 * federation.manifest.json and writes the import map that both the shell and
 * its remotes resolve @angular/*, @ngrx/*, rxjs and the kit through. Only then
 * is the app itself loaded, from bootstrap.ts.
 *
 * If the manifest can't be fetched, initFederation rejects *before* writing
 * that import map — and without it the shell's own Angular imports can't
 * resolve. So it starts again with no remotes: the shell works, and remote
 * pages show their fallback until Retry finds the manifest (federation.ts).
 */
const options = { hostRemoteEntry: { url: './remoteEntry.json' } };

initFederation(MANIFEST_URL, options)
  .catch((err: unknown) => {
    console.error('[federation] Starting without remotes:', err);
    return initFederation({}, options);
  })
  .catch((err: unknown) => {
    console.error(err);
    return null;
  })
  .then((federation) => import('./bootstrap').then((m) => m.bootstrap(federation)))
  .catch((err: unknown) => console.error(err));
