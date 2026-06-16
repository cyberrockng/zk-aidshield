/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    if (!isServer) {
      config.externals = [...(config.externals || []), 'sodium-native'];
    }

    if (isServer) {
      // Keep ZK packages out of the server bundle so WASM loads from node_modules
      const zkExternals = [
        /^@aztec\/bb\.js/,
        /^@noir-lang\//,
      ];
      const prev = config.externals || [];
      config.externals = Array.isArray(prev)
        ? [...prev, ...zkExternals]
        : [prev, ...zkExternals];
    }

    return config;
  },
};

export default nextConfig;
