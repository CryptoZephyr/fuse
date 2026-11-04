/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Architectural Decision #2 from T0 Spike:
   * `@mezo-org/passport`, `@mezo-org/orangekit`, `@mezo-org/orangekit-smart-account`,
   * and `@mezo-org/orangekit-contracts` use internal ESM directory imports or raw `.ts`
   * entrypoints and must be transpiled by Next.js.
   */
  transpilePackages: [
    "mezo-fuse",
    "@mezo-org/passport",
    "@mezo-org/orangekit",
    "@mezo-org/orangekit-smart-account",
    "@mezo-org/orangekit-contracts",
    "@mezo-org/mezod-contracts",
    "@mezo-org/musd-contracts",
    "@mezo-org/mezo-clay",
    "@mezo-org/sign-in-with-wallet",
  ],
  async headers() {
    return [
      {
        // Allow `/widget` to be embedded in any external builder app's iframe (DESIGN_SYSTEM.md & FRONTEND.md)
        source: "/widget/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
      {
        source: "/widget",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    config.resolve.alias = {
      ...config.resolve.alias,
      "@coinbase/cdp-sdk": false,
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
      "@react-native-async-storage/async-storage": false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
