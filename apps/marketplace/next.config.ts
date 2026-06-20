import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Resolve the workspace UI/types packages from source (via tsconfig paths) so
  // the marketplace runs without a separate package build step.
  transpilePackages: ['@ermulaku/ui', '@ermulaku/types'],
  // Tutor avatars in this demo come from the pravatar placeholder service.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'i.pravatar.cc' }],
  },
};

export default nextConfig;
