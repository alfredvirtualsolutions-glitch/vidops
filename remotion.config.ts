import path from "path";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setEntryPoint("remotion/index.ts");

// Resolve the "@/..." path alias from tsconfig.json when Remotion bundles the composition.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...(config.resolve?.alias ?? {}),
      "@": path.resolve(process.cwd()),
    },
  },
}));
