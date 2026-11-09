/**
 * Where the remote list is read from (relative to <base href>). In its own
 * file, with no imports, because main.ts reads it before Native Federation has
 * set up the import map that every Angular import resolves through.
 */
export const MANIFEST_URL = 'federation.manifest.json';
