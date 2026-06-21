import type { MetadataRoute } from 'next';

/** Web app manifest (Next serves it at /manifest.webmanifest and links it). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TutorHub — find and book a tutor',
    short_name: 'TutorHub',
    description: 'Browse expert tutors with real-time availability and book a lesson in seconds.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0e8f8a',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
