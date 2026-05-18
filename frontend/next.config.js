/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Suppress known false-positive "module not found" warnings from
    // MetaMask SDK (React Native storage) and WalletConnect (pino-pretty).
    // These code paths are never executed in a browser build.
    config.ignoreWarnings = [
      { module: /node_modules\/@metamask\/sdk/ },
      { module: /node_modules\/pino/ },
    ];
    return config;
  },
};

module.exports = nextConfig;
