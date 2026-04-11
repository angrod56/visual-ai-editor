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
    '@distube/ytdl-core',
  ],
  // Tell Vercel's file tracer to include ffmpeg/ffprobe binaries in the deployment bundle
  experimental: {
    outputFileTracingIncludes: {
      '/api/process/metadata': ['./node_modules/@ffmpeg-installer/**', './node_modules/@ffprobe-installer/**', './node_modules/fluent-ffmpeg/**'],
      '/api/process/transcribe': ['./node_modules/@ffmpeg-installer/**', './node_modules/@ffprobe-installer/**', './node_modules/fluent-ffmpeg/**'],
      '/api/edit/[id]/process': ['./node_modules/@ffmpeg-installer/**', './node_modules/@ffprobe-installer/**', './node_modules/fluent-ffmpeg/**', './lib/fonts/**'],
      '/api/upload/url': ['./node_modules/@distube/ytdl-core/**'],
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const FFMPEG_PACKAGES = [
        'fluent-ffmpeg',
        '@ffmpeg-installer/ffmpeg',
        '@ffprobe-installer/ffprobe',
      ];
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
