/** @type {import('next').NextConfig} */
const nextConfig = {
  // COOP + COEP enable SharedArrayBuffer for WASM (needed by snarkjs circuit execution).
  // credentialless COEP keeps Freighter extension compatible.
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
    // Polyfill Node.js built-ins absent in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      path: false,
      os: false,
      crypto: false,
    };

    if (!isServer) {
      config.externals = [...(config.externals || []), 'sodium-native'];
      // Required by snarkjs and circomlibjs for async WASM (circuit.wasm)
      config.experiments = { ...config.experiments, asyncWebAssembly: true };
    }

    if (isServer) {
      // Keep ZK libs client-side only (they depend on WASM / browser APIs)
      const zkExternals = [/^snarkjs/, /^circomlibjs/];
      const prev = config.externals || [];
      config.externals = Array.isArray(prev)
        ? [...prev, ...zkExternals]
        : [prev, ...zkExternals];
    }

    return config;
  },
};

export default nextConfig;
