/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  // Prevent webpack from bundling native ffmpeg packages — they must be required at runtime
  serverExternalPackages: [
    'fluent-ffmpeg',
    '@ffmpeg-installer/ffmpeg',
    '@ffprobe-installer/ffprobe',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      const FFMPEG_PACKAGES = [
        'fluent-ffmpeg',
        '@ffmpeg-installer/ffmpeg',
        '@ffprobe-installer/ffprobe',
      ];
      // config.externals can be a function or array — handle both
      const prev = config.externals ?? [];
      config.externals = [
        ...(Array.isArray(prev) ? prev : [prev]),
        ({ request }, callback) => {
          if (FFMPEG_PACKAGES.includes(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
