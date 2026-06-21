'use client';

import { useEffect } from 'react';

/** Registers the service worker once on the client; renders nothing. */
export function ServiceWorkerRegister(): null {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration is best-effort; the app works fine without it.
      });
    }
  }, []);
  return null;
}
