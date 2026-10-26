import type { NextConfig } from "next";
import { wrapNextjsConfigWithBraintrust } from "braintrust/next";

const nextConfig: NextConfig = {};

export default wrapNextjsConfigWithBraintrust(nextConfig);
