import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Avoid picking a stray lockfile outside this app (e.g. user home directory).
  outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
