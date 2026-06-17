/** @type {import('next').NextConfig} */
const nextConfig = {
  // COOP + COEP enable SharedArrayBuffer for Barretenberg multi-threaded WASM.
  // credentialless COEP (vs require-corp) keeps Freighter extension compatible.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };

    if (!isServer) {
      config.externals = [...(config.externals || []), 'sodium-native'];
      // Allow async WASM modules in browser bundles (required by bb.js)
      config.experiments = { ...config.experiments, asyncWebAssembly: true };
    }

    if (isServer) {
      const zkExternals = [/^@aztec\/bb\.js/, /^@noir-lang\//];
      const prev = config.externals || [];
      config.externals = Array.isArray(prev)
        ? [...prev, ...zkExternals]
        : [prev, ...zkExternals];
    }

    return config;
  },
};

export default nextConfig;
