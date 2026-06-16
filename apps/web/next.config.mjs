/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    // sodium-native is a Node native addon — exclude from browser bundles
    if (!isServer) {
      config.externals = [...(config.externals || []), 'sodium-native'];
    }
    return config;
  },
};

export default nextConfig;
