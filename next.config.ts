import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  basePath: '/wfh-timein',
  assetPrefix: '/wfh-timein',
  trailingSlash: true,
};

export default nextConfig;
