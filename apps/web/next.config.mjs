import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

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
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /node_modules\/require-addon\/lib\/node\.js/ },
      { module: /node_modules\/sodium-native\/index\.js/ },
    ];

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
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        // Stellar's signing module falls back to tweetnacl when sodium-native is
        // unavailable. Disable the optional native addon path in browser bundles
        // to avoid warnings from require-addon during Next builds.
        'sodium-native': false,
      };

      // Required by snarkjs and circomlibjs for async WASM (circuit.wasm)
      config.experiments = { ...config.experiments, asyncWebAssembly: true };

      // circomlibjs's exports field doesn't expose its src/ directory.
      // An absolute-path alias bypasses webpack 5's exports-field check entirely.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@stellar/stellar-sdk': path.join(__dirname, 'node_modules', '@stellar', 'stellar-sdk', 'lib', 'browser.js'),
        'circomlibjs/src/poseidon_constants_opt.js':
          path.join(__dirname, 'node_modules', 'circomlibjs', 'src', 'poseidon_constants_opt.js'),
      };
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
