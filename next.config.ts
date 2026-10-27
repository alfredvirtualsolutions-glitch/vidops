import type { NextConfig } from "next";
import { wrapNextjsConfigWithBraintrust } from "braintrust/next";

import path from "node:path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

export default wrapNextjsConfigWithBraintrust(nextConfig);
